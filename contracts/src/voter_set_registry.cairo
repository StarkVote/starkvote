use starknet::ContractAddress;

#[starknet::interface]
pub trait IVoterSetRegistry<TContractState> {
    fn add_voter(ref self: TContractState, commitment: u256);
    fn freeze(ref self: TContractState);
    fn get_leaf(self: @TContractState, index: u32) -> u256;
    fn get_leaf_count(self: @TContractState) -> u32;
    fn is_frozen(self: @TContractState) -> bool;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod VoterSetRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };

    const MAX_LEAVES: u32 = 1073741824; // 2^30

    #[storage]
    struct Storage {
        admin: ContractAddress,
        frozen: bool,
        leaf_count: u32,
        leaves: Map<u32, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        VoterAdded: VoterAdded,
        Frozen: Frozen,
    }

    #[derive(Drop, starknet::Event)]
    struct VoterAdded {
        #[key]
        index: u32,
        commitment: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Frozen {
        leaf_count: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.frozen.write(false);
        self.leaf_count.write(0);
    }

    #[abi(embed_v0)]
    impl IVoterSetRegistryImpl of super::IVoterSetRegistry<ContractState> {
        fn add_voter(ref self: ContractState, commitment: u256) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can add voters');
            assert(!self.frozen.read(), 'Registry is frozen');

            let current_count = self.leaf_count.read();
            assert(current_count < MAX_LEAVES, 'Max leaves exceeded');

            self.leaves.write(current_count, commitment);
            self.emit(VoterAdded { index: current_count, commitment });
            self.leaf_count.write(current_count + 1);
        }

        fn freeze(ref self: ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can freeze');
            assert(!self.frozen.read(), 'Already frozen');

            self.frozen.write(true);
            self.emit(Frozen { leaf_count: self.leaf_count.read() });
        }

        fn get_leaf(self: @ContractState, index: u32) -> u256 {
            assert(index < self.leaf_count.read(), 'Index out of bounds');
            self.leaves.read(index)
        }

        fn get_leaf_count(self: @ContractState) -> u32 {
            self.leaf_count.read()
        }

        fn is_frozen(self: @ContractState) -> bool {
            self.frozen.read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }
}
