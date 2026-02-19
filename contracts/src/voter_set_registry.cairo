use starknet::ContractAddress;

#[starknet::interface]
pub trait IVoterSetRegistry<TContractState> {
    fn add_eligible_batch(ref self: TContractState, poll_id: u64, addresses: Span<ContractAddress>);
    fn register_commitment(ref self: TContractState, poll_id: u64, commitment: u256);
    fn freeze(ref self: TContractState, poll_id: u64);
    fn get_leaf(self: @TContractState, poll_id: u64, index: u32) -> u256;
    fn get_leaf_count(self: @TContractState, poll_id: u64) -> u32;
    fn is_frozen(self: @TContractState, poll_id: u64) -> bool;
    fn get_poll_admin(self: @TContractState, poll_id: u64) -> ContractAddress;
    fn is_eligible(self: @TContractState, poll_id: u64, address: ContractAddress) -> bool;
    fn has_registered(self: @TContractState, poll_id: u64, address: ContractAddress) -> bool;
}

#[starknet::contract]
mod VoterSetRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
    };
    use core::num::traits::Zero;

    const MAX_LEAVES: u32 = 1073741824; // 2^30

    #[storage]
    struct Storage {
        poll_admin: Map<u64, ContractAddress>,
        frozen: Map<u64, bool>,
        leaf_count: Map<u64, u32>,
        leaves: Map<(u64, u32), u256>,
        eligible: Map<(u64, ContractAddress), bool>,
        registered: Map<(u64, ContractAddress), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EligibleAdded: EligibleAdded,
        CommitmentRegistered: CommitmentRegistered,
        Frozen: Frozen,
    }

    #[derive(Drop, starknet::Event)]
    struct EligibleAdded {
        #[key]
        poll_id: u64,
        #[key]
        address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CommitmentRegistered {
        #[key]
        poll_id: u64,
        #[key]
        index: u32,
        #[key]
        registrant: ContractAddress,
        commitment: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Frozen {
        #[key]
        poll_id: u64,
        leaf_count: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl IVoterSetRegistryImpl of super::IVoterSetRegistry<ContractState> {
        fn add_eligible_batch(ref self: ContractState, poll_id: u64, addresses: Span<ContractAddress>) {
            let caller = get_caller_address();
            assert(!self.frozen.read(poll_id), 'Voter set is frozen');

            let current_admin = self.poll_admin.read(poll_id);
            if current_admin.is_zero() {
                // First call for this poll_id — caller becomes admin
                self.poll_admin.write(poll_id, caller);
            } else {
                assert(caller == current_admin, 'Only poll admin');
            }

            let mut i: u32 = 0;
            loop {
                if i >= addresses.len() {
                    break;
                }
                let addr = *addresses.at(i);
                self.eligible.write((poll_id, addr), true);
                self.emit(EligibleAdded { poll_id, address: addr });
                i += 1;
            };
        }

        fn register_commitment(ref self: ContractState, poll_id: u64, commitment: u256) {
            let caller = get_caller_address();
            assert(!self.frozen.read(poll_id), 'Voter set is frozen');
            assert(self.eligible.read((poll_id, caller)), 'Caller is not eligible');
            assert(!self.registered.read((poll_id, caller)), 'Already registered');

            let current_count = self.leaf_count.read(poll_id);
            assert(current_count < MAX_LEAVES, 'Max leaves exceeded');

            self.leaves.write((poll_id, current_count), commitment);
            self.registered.write((poll_id, caller), true);
            self.emit(CommitmentRegistered { poll_id, index: current_count, registrant: caller, commitment });
            self.leaf_count.write(poll_id, current_count + 1);
        }

        fn freeze(ref self: ContractState, poll_id: u64) {
            let caller = get_caller_address();
            let current_admin = self.poll_admin.read(poll_id);
            assert(!current_admin.is_zero(), 'No voter set for this poll');
            assert(caller == current_admin, 'Only poll admin');
            assert(!self.frozen.read(poll_id), 'Already frozen');

            self.frozen.write(poll_id, true);
            self.emit(Frozen { poll_id, leaf_count: self.leaf_count.read(poll_id) });
        }

        fn get_leaf(self: @ContractState, poll_id: u64, index: u32) -> u256 {
            assert(index < self.leaf_count.read(poll_id), 'Index out of bounds');
            self.leaves.read((poll_id, index))
        }

        fn get_leaf_count(self: @ContractState, poll_id: u64) -> u32 {
            self.leaf_count.read(poll_id)
        }

        fn is_frozen(self: @ContractState, poll_id: u64) -> bool {
            self.frozen.read(poll_id)
        }

        fn get_poll_admin(self: @ContractState, poll_id: u64) -> ContractAddress {
            self.poll_admin.read(poll_id)
        }

        fn is_eligible(self: @ContractState, poll_id: u64, address: ContractAddress) -> bool {
            self.eligible.read((poll_id, address))
        }

        fn has_registered(self: @ContractState, poll_id: u64, address: ContractAddress) -> bool {
            self.registered.read((poll_id, address))
        }
    }
}
