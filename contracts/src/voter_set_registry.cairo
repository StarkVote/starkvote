use starknet::ContractAddress;

/// VoterSetRegistry - Stores eligible voter identity commitments
///
/// Flow:
/// 1. Admin adds voter commitments via add_voter()
/// 2. Admin freezes the registry via freeze() - locks the voter set
/// 3. Voters fetch leaves off-chain for proof generation
/// 4. Admin computes Merkle root off-chain (using fetch + compute-root scripts)
/// 5. Admin creates poll with the computed root
#[starknet::interface]
trait IVoterSetRegistry<TContractState> {
    fn add_voter(ref self: TContractState, commitment: felt252);
    fn freeze(ref self: TContractState);
    fn get_leaf(self: @TContractState, index: u32) -> felt252;
    fn get_leaf_count(self: @TContractState) -> u32;
    fn is_frozen(self: @TContractState) -> bool;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod VoterSetRegistry {
    use starknet::{ContractAddress, get_caller_address};

    /// Maximum number of voters (2^30 = 1 billion)
    /// Matches WorldCoin's verifier which uses tree depth 30
    const MAX_LEAVES: u32 = 1073741824;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        frozen: bool,
        leaf_count: u32,
        leaves: LegacyMap<u32, felt252>,
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
        commitment: felt252,
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
    impl VoterSetRegistryImpl of super::IVoterSetRegistry<ContractState> {
        /// Add a voter's identity commitment to the registry
        /// Only admin can call this, and only before freezing
        fn add_voter(ref self: ContractState, commitment: felt252) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can add voters');
            assert(!self.frozen.read(), 'Registry is frozen');

            let current_count = self.leaf_count.read();
            assert(current_count < MAX_LEAVES, 'Max leaves exceeded');

            // Store commitment at next index
            self.leaves.write(current_count, commitment);
            self.emit(VoterAdded { index: current_count, commitment });
            self.leaf_count.write(current_count + 1);
        }

        /// Freeze the registry - locks the voter set
        /// After freezing, no more voters can be added
        /// Admin should then compute Merkle root off-chain for poll creation
        fn freeze(ref self: ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can freeze');
            assert(!self.frozen.read(), 'Already frozen');

            self.frozen.write(true);
            self.emit(Frozen { leaf_count: self.leaf_count.read() });
        }

        /// Get commitment at specific index
        fn get_leaf(self: @ContractState, index: u32) -> felt252 {
            assert(index < self.leaf_count.read(), 'Index out of bounds');
            self.leaves.read(index)
        }

        /// Get total number of commitments in registry
        fn get_leaf_count(self: @ContractState) -> u32 {
            self.leaf_count.read()
        }

        /// Check if registry is frozen
        fn is_frozen(self: @ContractState) -> bool {
            self.frozen.read()
        }

        /// Get admin address
        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }
}
