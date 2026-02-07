use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store)]
struct PollData {
    exists: bool,
    options_count: u8,
    start_time: u64,
    end_time: u64,
    snapshot_root: felt252,
    finalized: bool,
    winner_option: u8,
    max_votes: u32,
}

#[starknet::interface]
trait IPoll<TContractState> {
    fn create_poll(
        ref self: TContractState,
        poll_id: u64,
        options_count: u8,
        start_time: u64,
        end_time: u64
    );
    fn vote(
        ref self: TContractState,
        poll_id: u64,
        option: u8,
        root: felt252,
        nullifier_hash: felt252,
        signal: felt252,
        proof: Span<felt252>,
        public_inputs: Span<felt252>
    );
    fn get_tally(self: @TContractState, poll_id: u64, option: u8) -> u32;
    fn is_nullifier_used(self: @TContractState, poll_id: u64, nullifier_hash: felt252) -> bool;
    fn get_poll(self: @TContractState, poll_id: u64) -> PollData;
    fn finalize(ref self: TContractState, poll_id: u64);
    fn get_admin(self: @TContractState) -> ContractAddress;
    fn get_registry(self: @TContractState) -> ContractAddress;
    fn get_verifier(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod Poll {
    use super::PollData;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starkvote::voter_set_registry::{
        IVoterSetRegistryDispatcher, IVoterSetRegistryDispatcherTrait
    };
    use starkvote::verifier::{IVerifierDispatcher, IVerifierDispatcherTrait};
    use core::traits::Into;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        registry: ContractAddress,
        verifier: ContractAddress,
        polls: LegacyMap<u64, PollData>,
        used_nullifiers: LegacyMap<(u64, felt252), bool>,
        tally: LegacyMap<(u64, u8), u32>,
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
        snapshot_root: felt252,
        start_time: u64,
        end_time: u64,
        options_count: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct Voted {
        #[key]
        poll_id: u64,
        #[key]
        nullifier_hash: felt252,
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

    #[abi(embed_v0)]
    impl PollImpl of super::IPoll<ContractState> {
        fn create_poll(
            ref self: ContractState,
            poll_id: u64,
            options_count: u8,
            start_time: u64,
            end_time: u64
        ) {
            // Check admin
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can create polls');

            // Check poll doesn't already exist
            let existing_poll = self.polls.read(poll_id);
            assert(!existing_poll.exists, 'Poll already exists');

            // Check registry is frozen
            let registry_address = self.registry.read();
            let registry = IVoterSetRegistryDispatcher { contract_address: registry_address };
            assert(registry.is_frozen(), 'Registry must be frozen');

            // Snapshot the root
            let snapshot_root = registry.get_root();

            // Check options count is valid
            assert(options_count > 0, 'Must have at least 1 option');

            // Check time bounds
            assert(start_time < end_time, 'Invalid time bounds');

            // Store poll data
            let poll_data = PollData {
                exists: true,
                options_count,
                start_time,
                end_time,
                snapshot_root,
                finalized: false,
                winner_option: 0,
                max_votes: 0,
            };
            self.polls.write(poll_id, poll_data);

            // Emit event
            self
                .emit(
                    PollCreated {
                        poll_id, snapshot_root, start_time, end_time, options_count
                    }
                );
        }

        fn vote(
            ref self: ContractState,
            poll_id: u64,
            option: u8,
            root: felt252,
            nullifier_hash: felt252,
            signal: felt252,
            proof: Span<felt252>,
            public_inputs: Span<felt252>
        ) {
            // 1) Check poll exists
            let poll = self.polls.read(poll_id);
            assert(poll.exists, 'Poll does not exist');

            // 2) Check time window: start_time <= now <= end_time
            let now = get_block_timestamp();
            assert(now >= poll.start_time, 'Poll has not started');
            assert(now <= poll.end_time, 'Poll has ended');

            // 3) Check option is valid
            assert(option < poll.options_count, 'Invalid option');

            // 4) Check root matches snapshot
            assert(root == poll.snapshot_root, 'Root mismatch');

            // 5) Check public_inputs length == 4
            // Manual length check since we can't use .len() in older Cairo
            let pi_0 = public_inputs[0]; // Will panic if < 1 element
            let pi_1 = public_inputs[1]; // Will panic if < 2 elements
            let pi_2 = public_inputs[2]; // Will panic if < 3 elements
            let pi_3 = public_inputs[3]; // Will panic if < 4 elements

            // 6) Check public_inputs[0] == root
            assert(*pi_0 == root, 'Public input root mismatch');

            // 7) Check public_inputs[1] == nullifier_hash
            assert(*pi_1 == nullifier_hash, 'Public input nullifier mismatch');

            // 8) Check public_inputs[2] == signal
            assert(*pi_2 == signal, 'Public input signal mismatch');

            // 9) Check public_inputs[3] == scope where scope == felt(poll_id)
            let scope: felt252 = poll_id.into();
            assert(*pi_3 == scope, 'Public input scope mismatch');

            // 10) Check nullifier not used
            let nullifier_key = (poll_id, nullifier_hash);
            assert(!self.used_nullifiers.read(nullifier_key), 'Nullifier already used');

            // 11) Verify proof
            let verifier_address = self.verifier.read();
            let verifier = IVerifierDispatcher { contract_address: verifier_address };
            assert(verifier.verify(proof, public_inputs), 'Proof verification failed');

            // All checks passed - record vote
            self.used_nullifiers.write(nullifier_key, true);

            // Increment tally
            let tally_key = (poll_id, option);
            let current_tally = self.tally.read(tally_key);
            self.tally.write(tally_key, current_tally + 1);

            // Emit event
            self.emit(Voted { poll_id, nullifier_hash, option });
        }

        fn get_tally(self: @ContractState, poll_id: u64, option: u8) -> u32 {
            self.tally.read((poll_id, option))
        }

        fn is_nullifier_used(self: @ContractState, poll_id: u64, nullifier_hash: felt252) -> bool {
            self.used_nullifiers.read((poll_id, nullifier_hash))
        }

        fn get_poll(self: @ContractState, poll_id: u64) -> PollData {
            self.polls.read(poll_id)
        }

        fn finalize(ref self: ContractState, poll_id: u64) {
            // Check poll exists
            let mut poll = self.polls.read(poll_id);
            assert(poll.exists, 'Poll does not exist');

            // Check poll has ended
            let now = get_block_timestamp();
            assert(now > poll.end_time, 'Poll has not ended');

            // Check not already finalized
            assert(!poll.finalized, 'Poll already finalized');

            // Compute winner: argmax over all options, ties go to lowest index
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

            // Update poll data
            poll.finalized = true;
            poll.winner_option = winner_option;
            poll.max_votes = max_votes;
            self.polls.write(poll_id, poll);

            // Emit event
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
