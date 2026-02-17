# StarkVote

Anonymous voting on Starknet using Semaphore v4 zero-knowledge proofs. Voters prove group membership without revealing their identity, and votes are tallied on-chain with double-vote prevention via nullifiers.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for protocol details.

## Prerequisites

- [Scarb 2.14.0](https://docs.swmansion.com/scarb/download.html) (Cairo build toolchain)
- [Node.js 18+](https://nodejs.org/) with npm
- A Starknet Sepolia wallet with testnet ETH/STRK

## Project Structure

```
contracts/           Cairo smart contracts
  src/
    poll.cairo                 Poll creation, proof verification, tallying
    voter_set_registry.cairo   On-chain voter commitment storage
    verifier.cairo             Semaphore30Verifier (wraps Garaga)
    groth16_verifier.cairo     Garaga-generated BN254 verifier
  garaga/                      Vendored Garaga v1.0.1 library

zk/                  Off-chain scripts (TypeScript)
  scripts/
    gen_identity_commitment.ts   Generate Semaphore identity
    deploy_contracts.ts          Deploy all 4 contracts
    interact.ts                  Add voters, create polls, vote, tally
    fetch_leaves.ts              Fetch on-chain voter leaves
    compute_merkle_root.ts       Build Merkle tree from leaves
    gen_proof.ts                 Generate Semaphore ZK proof
    gen_calldata.ts              Format proof as Garaga calldata (WASM)
  artifacts/                     Semaphore circuit files (wasm, zkey)
  .local/                        Generated session data (gitignored)
  samples/                       Generated proof outputs (gitignored)

docs/
  ARCHITECTURE.md    Protocol architecture and cryptographic details
  ZK_PROTOCOL.md     Detailed ZK proof explanation
```

## Setup

### 1. Build contracts

The contracts include a vendored copy of [Garaga v1.0.1](https://github.com/keep-starknet-strange/garaga) for Groth16 BN254 verification.

```bash
cd contracts
scarb build
```

This produces compiled artifacts in `contracts/target/dev/`.

### 2. Install Node.js dependencies

```bash
cd zk
npm install
```

### 3. Configure environment

```bash
cp zk/.env.example zk/.env
```

Edit `zk/.env` with your Starknet Sepolia wallet credentials:

```env
ADMIN_ADDRESS=0x...
PRIVATE_KEY=0x...
RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

> **Note:** Deploying the Groth16 verifier (~2MB contract) requires a private RPC (e.g. Alchemy, Infura). Public RPCs may reject the large declare transaction.

### 4. Download Semaphore artifacts

```bash
curl -L -o zk/artifacts/semaphore30.wasm \
  https://snark-artifacts.pse.dev/semaphore/latest/semaphore-30.wasm

curl -L -o zk/artifacts/semaphore30.zkey \
  https://snark-artifacts.pse.dev/semaphore/latest/semaphore-30.zkey
```

## End-to-End Testing Guide

Run all commands from the `zk/` directory.

### Step 1: Generate identity

```bash
npm run gen-identity
```

Creates `zk/.local/identity.json` with a Semaphore identity (private key + commitment).

### Step 2: Deploy contracts

```bash
npm run deploy
```

Deploys all 4 contracts: Groth16VerifierBN254, Semaphore30Verifier, VoterSetRegistry, Poll. Addresses are saved to `zk/.local/contract_addresses.json`.

### Step 3: Register voter

```bash
# Use the commitment from Step 1
npm run interact -- add-voters <commitment>
```

### Step 4: Freeze registry

```bash
npm run interact -- freeze-registry
```

Locks the voter set permanently.

### Step 5: Fetch on-chain leaves

```bash
npm run fetch-leaves
```

Reads all committed leaves from the registry. Saved to `zk/.local/leaves.json`.

### Step 6: Compute Merkle root

```bash
npm run compute-root
```

Builds the depth-30 Poseidon Merkle tree. Saved to `zk/.local/merkle_root.json`.

### Step 7: Create proof config

Create `zk/.local/proof_config.json`:

```json
{
  "poll_id": 1,
  "option": 0,
  "leaf_index": 0
}
```

### Step 8: Create poll

```bash
# Arguments: poll_id, options_count, start_time, end_time, merkle_root
START=$(( $(date +%s) - 3600 ))
END=$(( $(date +%s) + 86400 ))
ROOT=$(jq -r '.root' ./.local/merkle_root.json)

npm run interact -- create-poll 1 2 $START $END $ROOT
```

### Step 9: Generate ZK proof

```bash
npm run gen-proof
```

Generates the Semaphore Groth16 proof. Outputs `zk/samples/proof.json` and `zk/samples/public.json`.

### Step 10: Format calldata for Garaga

```bash
npm run format-calldata
```

Converts the proof into Garaga-compatible calldata using Garaga's WASM library. Outputs `zk/samples/worldcoin_calldata.json`.

### Step 11: Submit vote

```bash
npm run interact -- submit-vote samples/worldcoin_calldata.json
```

Submits the vote transaction with the ZK proof. The contract verifies the proof on-chain.

### Step 12: Check results

```bash
# Get vote count for poll 1, option 0
npm run interact -- get-tally 1 0
```

### Step 13: Finalize poll

After `end_time` has passed, anyone can finalize the poll to compute and store the winner on-chain:

```bash
npm run finalize-poll -- 1

# Or equivalently:
npm run interact -- finalize 1

# View full poll data including winner
npm run interact -- get-poll 1
```

### Verify double-vote protection

Attempting to submit the same proof again should fail with `'Nullifier already used'`.

## Script Reference

| Script | Command | Description |
|--------|---------|-------------|
| gen-identity | `npm run gen-identity` | Generate Semaphore identity |
| deploy | `npm run deploy` | Deploy all contracts |
| interact | `npm run interact -- <cmd>` | Contract interaction (see subcommands) |
| fetch-leaves | `npm run fetch-leaves` | Fetch voter leaves from chain |
| compute-root | `npm run compute-root` | Compute Merkle root from leaves |
| gen-proof | `npm run gen-proof` | Generate Semaphore ZK proof |
| format-calldata | `npm run format-calldata` | Format proof as Garaga calldata |
| finalize-poll | `npm run finalize-poll -- <pollId>` | Finalize poll and store winner |

### interact subcommands

| Subcommand | Usage |
|------------|-------|
| add-voters | `npm run interact -- add-voters <commitment1> [commitment2 ...]` |
| freeze-registry | `npm run interact -- freeze-registry` |
| create-poll | `npm run interact -- create-poll <pollId> <optionsCount> <startTime> <endTime> <root>` |
| submit-vote | `npm run interact -- submit-vote <calldata.json>` |
| get-tally | `npm run interact -- get-tally <pollId> <option>` |
| finalize | `npm run interact -- finalize <pollId>` |
| get-poll | `npm run interact -- get-poll <pollId>` |

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| Groth16VerifierBN254 | `0x1b04659cad4e89198596e4064e4b2e60c6884e6d69bd7509ce1b8cde34ef86d` |
| Semaphore30Verifier | `0x3113242f9bf76b126c003585d5654a4ad74270e3e8f2d19e98fa1e995afdd1f` |
| VoterSetRegistry | `0x321c07938f8be9bd1d27c11ea596c786dfbf39fb6a814e98171afff2bada3ed` |
| Poll | `0x5777882c5ad204f6eee6c0dbe9632b886becef514f415b7c6b163d89058c542` |
