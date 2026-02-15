use starknet::ContractAddress;

/// Generic verifier interface for ZK proof verification
/// Any verifier (MockVerifier, WorldCoin's verifier, etc.) implements this interface
#[starknet::interface]
trait IVerifier<TContractState> {
    /// Verifies a ZK proof against public inputs
    /// Returns true if proof is valid, false otherwise
    ///
    /// @param proof: ZK proof data (Groth16 proof components)
    /// @param public_inputs: [root, nullifier_hash, signal, scope]
    fn verify(self: @TContractState, proof: Span<felt252>, public_inputs: Span<felt252>) -> bool;
}

/// Mock verifier for testing contract logic without real proofs
/// Always returns true - useful for testing poll creation, voting flow, tallying
///
/// Usage:
/// 1. Deploy MockVerifier
/// 2. Deploy Poll with MockVerifier address
/// 3. Test all contract logic quickly
/// 4. When ready for real proofs, deploy Poll with WorldCoin's verifier address
#[starknet::contract]
mod MockVerifier {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl MockVerifierImpl of super::IVerifier<ContractState> {
        fn verify(self: @ContractState, proof: Span<felt252>, public_inputs: Span<felt252>) -> bool {
            // Always return true - no actual verification
            // This allows testing Poll contract logic without generating ZK proofs
            true
        }
    }
}
