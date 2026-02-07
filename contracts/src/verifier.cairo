use starknet::ContractAddress;

/// Verifier interface for ZK proof verification
/// This interface will be implemented by the Garaga-generated verifier contract
#[starknet::interface]
trait IVerifier<TContractState> {
    /// Verifies a proof against public inputs
    /// Returns true if the proof is valid, false otherwise
    ///
    /// @param proof: The ZK proof data (format depends on Garaga output)
    /// @param public_inputs: Array of public inputs in the order [root, nullifier_hash, signal, scope]
    ///
    /// TODO: Update the proof parameter type once Garaga verifier is integrated
    /// The exact proof encoding will depend on Garaga's output format
    fn verify(self: @TContractState, proof: Span<felt252>, public_inputs: Span<felt252>) -> bool;
}

/// Mock verifier for testing
/// Always returns true to allow testing the Poll contract logic
/// without a real ZK verifier
#[starknet::contract]
mod MockVerifier {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl MockVerifierImpl of super::IVerifier<ContractState> {
        /// Mock implementation that always returns true
        /// This allows testing the Poll contract without real proofs
        fn verify(self: @ContractState, proof: Span<felt252>, public_inputs: Span<felt252>) -> bool {
            // TODO: Replace this mock with the real Garaga-generated verifier
            // The real verifier will:
            // 1. Parse the proof data according to Garaga's format
            // 2. Perform pairing checks or other verification computations
            // 3. Return true only if the proof is cryptographically valid
            true
        }
    }
}

/// Placeholder for real Garaga verifier
/// This will be replaced by the actual generated verifier contract
///
/// Expected integration steps:
/// 1. Generate verifier using Garaga from the Semaphore circuit
/// 2. Replace this module with the generated verifier code
/// 3. Update the proof type in IVerifier interface to match Garaga's format
/// 4. Update Poll contract to use the real verifier instead of MockVerifier
#[starknet::contract]
mod GaragaVerifier {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl GaragaVerifierImpl of super::IVerifier<ContractState> {
        fn verify(self: @ContractState, proof: Span<felt252>, public_inputs: Span<felt252>) -> bool {
            // TODO: Replace with actual Garaga-generated verification code
            assert(1 == 0, 'Use MockVerifier for testing');
            false
        }
    }
}
