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
trait IPoll<TContractState> {
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
    use core::array::SpanTrait;
    use core::option::OptionTrait;
    use core::traits::Into;
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starkvote::verifier::{IWorldcoinVerifierDispatcher, IWorldcoinVerifierDispatcherTrait};
    use starkvote::voter_set_registry::{
        IVoterSetRegistryDispatcher, IVoterSetRegistryDispatcherTrait
    };

    #[storage]
    struct Storage {
        admin: ContractAddress,
        registry: ContractAddress,
        verifier: ContractAddress,
        polls: LegacyMap<u64, PollData>,
        used_nullifiers: LegacyMap<(u64, u256), bool>,
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

    #[external(v0)]
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

    #[external(v0)]
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

        let pi_0 = verified_public_inputs[0];
        let pi_1 = verified_public_inputs[1];
        let pi_2 = verified_public_inputs[2];
        let pi_3 = verified_public_inputs[3];

        assert(*pi_0 == poll.snapshot_root, 'Root mismatch');

        let scope = u256 { low: poll_id.into(), high: 0 };
        assert(*pi_3 == scope, 'Public input scope mismatch');

        let signal = u256 { low: option.into(), high: 0 };
        assert(*pi_2 == signal, 'Public input signal mismatch');

        let nullifier_hash = *pi_1;
        let nullifier_key = (poll_id, nullifier_hash);
        assert(!self.used_nullifiers.read(nullifier_key), 'Nullifier already used');

        self.used_nullifiers.write(nullifier_key, true);

        let tally_key = (poll_id, option);
        let current_tally = self.tally.read(tally_key);
        self.tally.write(tally_key, current_tally + 1);

        self.emit(Voted { poll_id, nullifier_hash, option });
    }

    #[external(v0)]
    fn get_tally(self: @ContractState, poll_id: u64, option: u8) -> u32 {
        self.tally.read((poll_id, option))
    }

    #[external(v0)]
    fn is_nullifier_used(self: @ContractState, poll_id: u64, nullifier_hash: u256) -> bool {
        self.used_nullifiers.read((poll_id, nullifier_hash))
    }

    #[external(v0)]
    fn get_poll(self: @ContractState, poll_id: u64) -> PollData {
        self.polls.read(poll_id)
    }

    #[external(v0)]
    fn finalize(ref self: ContractState, poll_id: u64) {
        let mut poll = self.polls.read(poll_id);
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

        poll.finalized = true;
        poll.winner_option = winner_option;
        poll.max_votes = max_votes;
        self.polls.write(poll_id, poll);

        self.emit(PollFinalized { poll_id, winner_option, max_votes });
    }

    #[external(v0)]
    fn get_admin(self: @ContractState) -> ContractAddress {
        self.admin.read()
    }

    #[external(v0)]
    fn get_registry(self: @ContractState) -> ContractAddress {
        self.registry.read()
    }

    #[external(v0)]
    fn get_verifier(self: @ContractState) -> ContractAddress {
        self.verifier.read()
    }
}
