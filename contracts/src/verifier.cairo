/// Semaphore30Verifier: Wraps the Garaga-generated Groth16 verifier
/// to match the IWorldcoinVerifier interface expected by Poll contract.
use starknet::ContractAddress;

#[starknet::interface]
trait IWorldcoinVerifier<TContractState> {
    /// Returns `Some(public_inputs)` if the proof is valid, `None` otherwise.
    ///
    /// `public_inputs` are expected in Semaphore order:
    /// [root, nullifier_hash, signal, scope]
    fn verify_groth16_proof_bn254(
        self: @TContractState, full_proof_with_hints: Span<felt252>
    ) -> Option<Span<u256>>;
}

#[starknet::contract]
mod Semaphore30Verifier {
    use starkvote::groth16_verifier::{IGroth16VerifierBN254Dispatcher, IGroth16VerifierBN254DispatcherTrait};
    use core::option::OptionTrait;
    use starknet::ContractAddress;

    #[storage]
    struct Storage {
        garaga_verifier: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, garaga_verifier: ContractAddress) {
        self.garaga_verifier.write(garaga_verifier);
    }

    #[abi(embed_v0)]
    impl IWorldcoinVerifierImpl of super::IWorldcoinVerifier<ContractState> {
        fn verify_groth16_proof_bn254(
            self: @ContractState, full_proof_with_hints: Span<felt252>
        ) -> Option<Span<u256>> {
            let verifier_address = self.garaga_verifier.read();
            let verifier = IGroth16VerifierBN254Dispatcher { contract_address: verifier_address };

            let result = verifier.verify_groth16_proof_bn254(full_proof_with_hints);

            match result {
                Result::Ok(public_inputs) => Option::Some(public_inputs),
                Result::Err(_) => Option::None,
            }
        }
    }
}
