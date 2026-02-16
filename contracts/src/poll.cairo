use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store)]
struct PollData {
    exists: bool,
    options_count: u8,
    start_time: u64,
    end_time: u64,
    snapshot_root: u256,
    finalized: bool,
    winner_option: u8,
    max_votes: u32,
}

#[starknet::interface]
pub trait IPoll<TContractState> {
    fn create_poll(
        ref self: TContractState,
        poll_id: u64,
        options_count: u8,
        start_time: u64,
        end_time: u64,
        merkle_root: u256
    );
    fn vote(
        ref self: TContractState,
        poll_id: u64,
        option: u8,
        full_proof_with_hints: Span<felt252>
    );
    fn get_tally(self: @TContractState, poll_id: u64, option: u8) -> u32;
    fn is_nullifier_used(self: @TContractState, poll_id: u64, nullifier_hash: u256) -> bool;
    fn get_poll(self: @TContractState, poll_id: u64) -> PollData;
    fn finalize(ref self: TContractState, poll_id: u64);
    fn get_admin(self: @TContractState) -> ContractAddress;
    fn get_registry(self: @TContractState) -> ContractAddress;
    fn get_verifier(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod Poll {
    use super::PollData;
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };
    use starkvote::verifier::{IWorldcoinVerifierDispatcher, IWorldcoinVerifierDispatcherTrait};
    use starkvote::voter_set_registry::{
        IVoterSetRegistryDispatcher, IVoterSetRegistryDispatcherTrait
    };

    #[storage]
    struct Storage {
        admin: ContractAddress,
        registry: ContractAddress,
        verifier: ContractAddress,
        polls: Map<u64, PollData>,
        used_nullifiers: Map<(u64, u256), bool>,
        tally: Map<(u64, u8), u32>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PollCreated: PollCreated,
        Voted: Voted,
        PollFinalized: PollFinalized,
    }

    #[derive(Drop, starknet::Event)]
    struct PollCreated {
        #[key]
        poll_id: u64,
        snapshot_root: u256,
        start_time: u64,
        end_time: u64,
        options_count: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct Voted {
        #[key]
        poll_id: u64,
        nullifier_hash: u256,
        option: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct PollFinalized {
        #[key]
        poll_id: u64,
        winner_option: u8,
        max_votes: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        registry: ContractAddress,
        verifier: ContractAddress
    ) {
        self.admin.write(admin);
        self.registry.write(registry);
        self.verifier.write(verifier);
    }

    /// Compute keccak256(u256_big_endian(value)) >> 8
    /// This matches the Semaphore v4 hash: keccak256(zeroPadValue(toBeHex(value), 32)) >> 8n
    /// Note: Cairo's keccak syscall returns bytes in little-endian order,
    /// so we must reverse to match Ethereum's big-endian keccak256.
    fn semaphore_hash(value: u256) -> u256 {
        let raw = core::keccak::keccak_u256s_be_inputs(array![value].span());
        // Reverse bytes to convert from Cairo LE keccak to Ethereum BE keccak
        let hash = u256 {
            low: core::integer::u128_byte_reverse(raw.high),
            high: core::integer::u128_byte_reverse(raw.low),
        };
        hash / 256_u256 // right-shift by 8 bits
    }

    #[abi(embed_v0)]
    impl IPollImpl of super::IPoll<ContractState> {
        fn create_poll(
            ref self: ContractState,
            poll_id: u64,
            options_count: u8,
            start_time: u64,
            end_time: u64,
            merkle_root: u256
        ) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can create polls');

            let existing_poll = self.polls.read(poll_id);
            assert(!existing_poll.exists, 'Poll already exists');

            let registry_address = self.registry.read();
            let registry = IVoterSetRegistryDispatcher { contract_address: registry_address };
            assert(registry.is_frozen(), 'Registry must be frozen');

            assert(options_count > 0, 'Must have at least 1 option');
            assert(start_time < end_time, 'Invalid time bounds');

            let poll_data = PollData {
                exists: true,
                options_count,
                start_time,
                end_time,
                snapshot_root: merkle_root,
                finalized: false,
                winner_option: 0,
                max_votes: 0,
            };
            self.polls.write(poll_id, poll_data);

            self.emit(
                PollCreated {
                    poll_id, snapshot_root: merkle_root, start_time, end_time, options_count
                }
            );
        }

        fn vote(ref self: ContractState, poll_id: u64, option: u8, full_proof_with_hints: Span<felt252>) {
            let poll = self.polls.read(poll_id);
            assert(poll.exists, 'Poll does not exist');

            let now = get_block_timestamp();
            assert(now >= poll.start_time, 'Poll has not started');
            assert(now <= poll.end_time, 'Poll has ended');
            assert(option < poll.options_count, 'Invalid option');

            let verifier_address = self.verifier.read();
            let verifier = IWorldcoinVerifierDispatcher { contract_address: verifier_address };
            let verified_public_inputs_opt = verifier.verify_groth16_proof_bn254(full_proof_with_hints);
            assert(verified_public_inputs_opt.is_some(), 'Proof verification failed');
            let verified_public_inputs = verified_public_inputs_opt.unwrap();
            assert(verified_public_inputs.len() == 4, 'Invalid public input count');

            // Public inputs from Semaphore v4 circuit:
            // [0] = merkleRoot
            // [1] = nullifier_hash
            // [2] = message_hash  (keccak256(option) >> 8)
            // [3] = scope_hash    (keccak256(poll_id) >> 8)

            let pi_root = verified_public_inputs[0];
            let pi_nullifier = verified_public_inputs[1];
            let pi_signal = verified_public_inputs[2];
            let pi_scope = verified_public_inputs[3];

            // Check merkle root matches snapshot
            assert(*pi_root == poll.snapshot_root, 'Root mismatch');

            // Check scope: hash poll_id to match Semaphore's semaphoreHash
            let scope_raw = u256 { low: poll_id.into(), high: 0 };
            let scope_hash = semaphore_hash(scope_raw);
            assert(*pi_scope == scope_hash, 'Public input scope mismatch');

            // Check signal: hash option to match Semaphore's semaphoreHash
            let signal_raw = u256 { low: option.into(), high: 0 };
            let signal_hash = semaphore_hash(signal_raw);
            assert(*pi_signal == signal_hash, 'Public input signal mismatch');

            // Check nullifier not already used (prevents double voting)
            let nullifier_hash = *pi_nullifier;
            let nullifier_key = (poll_id, nullifier_hash);
            assert(!self.used_nullifiers.read(nullifier_key), 'Nullifier already used');

            self.used_nullifiers.write(nullifier_key, true);

            let tally_key = (poll_id, option);
            let current_tally = self.tally.read(tally_key);
            self.tally.write(tally_key, current_tally + 1);

            self.emit(Voted { poll_id, nullifier_hash, option });
        }

        fn get_tally(self: @ContractState, poll_id: u64, option: u8) -> u32 {
            self.tally.read((poll_id, option))
        }

        fn is_nullifier_used(self: @ContractState, poll_id: u64, nullifier_hash: u256) -> bool {
            self.used_nullifiers.read((poll_id, nullifier_hash))
        }

        fn get_poll(self: @ContractState, poll_id: u64) -> PollData {
            self.polls.read(poll_id)
        }

        fn finalize(ref self: ContractState, poll_id: u64) {
            let poll = self.polls.read(poll_id);
            assert(poll.exists, 'Poll does not exist');

            let now = get_block_timestamp();
            assert(now > poll.end_time, 'Poll has not ended');
            assert(!poll.finalized, 'Poll already finalized');

            let mut winner_option: u8 = 0;
            let mut max_votes: u32 = self.tally.read((poll_id, 0));

            let mut i: u8 = 1;
            loop {
                if i >= poll.options_count {
                    break;
                }

                let votes = self.tally.read((poll_id, i));
                if votes > max_votes {
                    max_votes = votes;
                    winner_option = i;
                }

                i += 1;
            };

            let finalized_poll = PollData {
                exists: poll.exists,
                options_count: poll.options_count,
                start_time: poll.start_time,
                end_time: poll.end_time,
                snapshot_root: poll.snapshot_root,
                finalized: true,
                winner_option,
                max_votes,
            };
            self.polls.write(poll_id, finalized_poll);

            self.emit(PollFinalized { poll_id, winner_option, max_votes });
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_registry(self: @ContractState) -> ContractAddress {
            self.registry.read()
        }

        fn get_verifier(self: @ContractState) -> ContractAddress {
            self.verifier.read()
        }
    }
}
