use starknet::ContractAddress;

#[starknet::interface]
trait IVoterSetRegistry<TContractState> {
    fn add_voter(ref self: TContractState, commitment: felt252);
    fn freeze(ref self: TContractState);
    fn get_leaf(self: @TContractState, index: u32) -> felt252;
    fn get_leaf_count(self: @TContractState) -> u32;
    fn get_root(self: @TContractState) -> felt252;
    fn is_frozen(self: @TContractState) -> bool;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod VoterSetRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use core::poseidon::poseidon_hash_span;
    use core::array::ArrayTrait;
    use core::traits::Into;

    const TREE_DEPTH: u8 = 20;
    const MAX_LEAVES: u32 = 1048576; // 2^20

    #[storage]
    struct Storage {
        admin: ContractAddress,
        frozen: bool,
        leaf_count: u32,
        leaves: LegacyMap<u32, felt252>,
        root: felt252,
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
        root: felt252,
        leaf_count: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.frozen.write(false);
        self.leaf_count.write(0);
        self.root.write(0);
    }

    #[abi(embed_v0)]
    impl VoterSetRegistryImpl of super::IVoterSetRegistry<ContractState> {
        fn add_voter(ref self: ContractState, commitment: felt252) {
            // Check admin
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can add voters');

            // Check not frozen
            assert(!self.frozen.read(), 'Registry is frozen');

            // Check not exceeding max leaves
            let current_count = self.leaf_count.read();
            assert(current_count < MAX_LEAVES, 'Max leaves exceeded');

            // Store leaf
            self.leaves.write(current_count, commitment);

            // Emit event
            self.emit(VoterAdded { index: current_count, commitment });

            // Increment count
            self.leaf_count.write(current_count + 1);
        }

        fn freeze(ref self: ContractState) {
            // Check admin
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can freeze');

            // Check not already frozen
            assert(!self.frozen.read(), 'Already frozen');

            // Compute Merkle root
            let leaf_count = self.leaf_count.read();
            let computed_root = self.compute_merkle_root(leaf_count);

            // Store root and set frozen
            self.root.write(computed_root);
            self.frozen.write(true);

            // Emit event
            self.emit(Frozen { root: computed_root, leaf_count });
        }

        fn get_leaf(self: @ContractState, index: u32) -> felt252 {
            assert(index < self.leaf_count.read(), 'Index out of bounds');
            self.leaves.read(index)
        }

        fn get_leaf_count(self: @ContractState) -> u32 {
            self.leaf_count.read()
        }

        fn get_root(self: @ContractState) -> felt252 {
            self.root.read()
        }

        fn is_frozen(self: @ContractState) -> bool {
            self.frozen.read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Computes Merkle root from stored leaves
        /// WARNING: This uses a placeholder hash function.
        /// TODO: Replace with proper Poseidon hash matching the Semaphore circuit
        fn compute_merkle_root(self: @ContractState, leaf_count: u32) -> felt252 {
            if leaf_count == 0 {
                return 0;
            }

            // Build the tree level by level
            let mut current_level: Array<felt252> = ArrayTrait::new();

            // Initialize with leaves (padded with zeros)
            let max_leaves: u32 = 1048576_u32; // 2^20
            let mut i: u32 = 0;
            loop {
                if i >= max_leaves {
                    break;
                }

                if i < leaf_count {
                    current_level.append(self.leaves.read(i));
                } else {
                    current_level.append(0); // Zero padding
                }

                i += 1;
            };

            // Hash up the tree
            let mut level_size = max_leaves;
            let mut depth: u8 = 0;
            loop {
                if depth >= TREE_DEPTH {
                    break;
                }

                let mut next_level: Array<felt252> = ArrayTrait::new();
                let current_span = current_level.span();
                let mut j: u32 = 0;

                loop {
                    if j >= level_size {
                        break;
                    }

                    let left = *current_span[j];
                    let right = *current_span[j + 1];
                    let parent = InternalImpl::hash2(left, right);
                    next_level.append(parent);

                    j += 2;
                };

                current_level = next_level;
                level_size = level_size / 2;
                depth += 1;
            };

            // Return root
            let final_span = current_level.span();
            *final_span[0]
        }

        /// Placeholder hash function for Merkle tree
        /// WARNING: This is a PLACEHOLDER that must be replaced with proper Poseidon hash
        /// that matches the Semaphore circuit's hash function exactly.
        ///
        /// TODO: Use the exact Poseidon hash function with the same parameters as the circuit:
        /// - Same number of rounds
        /// - Same S-box exponent
        /// - Same MDS matrix
        /// - Same round constants
        ///
        /// For Semaphore compatibility, this should typically be:
        /// poseidon([left, right]) with proper parameter configuration
        fn hash2(left: felt252, right: felt252) -> felt252 {
            // Simple placeholder using array span
            let mut arr: Array<felt252> = ArrayTrait::new();
            arr.append(left);
            arr.append(right);
            poseidon_hash_span(arr.span())

            // TODO: Verify this matches Semaphore's Poseidon configuration
            // May need to use: core::poseidon::hades_permutation or similar
        }
    }
}
