# StarkVote

Anonymous voting on Starknet using Semaphore proofs and Worldcoin's deployed Groth16 verifier.

## Production Verifier

- Network: Starknet Sepolia
- Worldcoin verifier:
  `0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a`
- No mock verifier flow in this repo.

## Quick Start

```powershell
cd contracts
scarb build

cd ..\zk
npm install
```

Create `zk/.env`:

```env
ADMIN_ADDRESS=0x...
PRIVATE_KEY=0x...
RPC_URL=https://rpc.starknet-testnet.lava.build
```

Deploy:

```powershell
npm run deploy
```

This deploys:
- `VoterSetRegistry`
- `Poll` configured to call Worldcoin verifier

Addresses are saved in `zk/.local/contract_addresses.json`.

## End-To-End Flow

1. Generate identities:
   - `npm run gen-identity`
2. Add commitments and freeze registry:
   - `npm run interact -- add-voters <c1> <c2> ...`
   - `npm run interact -- freeze-registry`
3. Fetch leaves and compute root:
   - `npm run fetch-leaves`
   - `npm run compute-root`
4. Create poll:
   - `npm run interact -- create-poll <pollId> <options> <start> <end> <rootHex>`
5. Generate proof:
   - `npm run gen-proof`
6. Generate Worldcoin calldata:
   - `npm run format-calldata`
7. Submit vote:
   - `npm run interact -- submit-vote samples/worldcoin_calldata.json`
8. Check tally/finalize:
   - `npm run interact -- get-tally <pollId> <option>`
   - `npm run interact -- finalize <pollId>`

Detailed step-by-step: `TESTING_GUIDE.md`.

## Script Reference (`zk/package.json`)

- `npm run deploy`
- `npm run interact -- <command>`
- `npm run gen-identity`
- `npm run fetch-leaves`
- `npm run compute-root`
- `npm run gen-proof`
- `npm run format-calldata`

## Contract Summary

- `contracts/src/voter_set_registry.cairo`
  - Stores voter commitments as `u256`
  - Admin can add voters, then freeze

- `contracts/src/poll.cairo`
  - Stores poll config and snapshot root (`u256`)
  - Verifies Semaphore proof by calling Worldcoin verifier
  - Checks returned public inputs `[root, nullifier_hash, signal, scope]`
  - Prevents double voting with `(poll_id, nullifier_hash)`

- `contracts/src/verifier.cairo`
  - Interface for Worldcoin verifier entrypoint:
    `verify_groth16_proof_bn254`
