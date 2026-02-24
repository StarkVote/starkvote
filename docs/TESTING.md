# End-to-End Testing Guide

Run all commands from the `zk/` directory.

---

## Setup

### Prerequisites

- [Scarb 2.14.0](https://docs.swmansion.com/scarb/download.html) (Cairo build toolchain)
- [Node.js 18+](https://nodejs.org/) with npm
- A Starknet Sepolia wallet with testnet ETH/STRK

### 1. Build contracts

```bash
cd contracts
scarb build
```

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
ACCOUNT_ADDRESS=0x...
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

---

## Phase 1: Deploy

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

---

## Phase 2: Voter Registration (per poll)

Each poll has its own independent voter set. The first caller to `add-eligible` for a given `poll_id` becomes its admin. The `poll_id` must match the one used when creating the poll in Phase 3.

### Step 3: Add eligible addresses (poll creator)

```bash
# Whitelist wallet addresses for poll 1 (first call makes you the admin)
npm run interact -- add-eligible 1 <address1> [address2 ...]
```

### Step 4: Register commitment (each voter)

Each eligible voter configures their own wallet in `zk/.env`, then self-registers their Semaphore commitment:

```bash
# Use the commitment from Step 1
npm run interact -- register-commitment 1 <commitment>
```

### Step 5: Freeze voter set

```bash
npm run interact -- freeze-registry 1
```

**Locks the voter set for poll 1 permanently. Only the poll admin can freeze. This must be done before creating the poll.**

---

## Phase 3: Poll Creation

### Step 6: Fetch on-chain leaves

```bash
npm run fetch-leaves -- 1
```

Reads all committed leaves for poll 1 from the registry. Saved to `zk/.local/leaves.json`.

### Step 7: Compute Merkle root

```bash
npm run compute-root
```

Builds the depth-30 Poseidon Merkle tree. Saved to `zk/.local/merkle_root.json`.

### Step 8: Create poll

```bash
# Arguments: poll_id, options_count, start_time, end_time, merkle_root
START=$(( $(date +%s) - 3600 ))
END=$(( $(date +%s) + 300 ))
ROOT=$(jq -r '.root' ./.local/merkle_root.json)

npm run interact -- create-poll 1 2 $START $END $ROOT
```

---

## Phase 4: Voting

### Step 9: Create proof config

Create `zk/.local/proof_config.json`:

```json
{
  "poll_id": 1,
  "option": 0,
  "leaf_index": 0
}
```

### Step 10: Generate ZK proof

```bash
npm run gen-proof
```

Generates the Semaphore Groth16 proof. Outputs `zk/samples/proof.json` and `zk/samples/public.json`.

### Step 11: Format calldata for Garaga

```bash
npm run format-calldata
```

Converts the proof into Garaga-compatible calldata using Garaga's WASM library. Outputs `zk/samples/worldcoin_calldata.json`.

### Step 12: Submit vote

```bash
npm run interact -- submit-vote samples/worldcoin_calldata.json
```

Submits the vote transaction with the ZK proof. The contract verifies the proof on-chain.

---

## Phase 5: Results

### Step 13: Check results

```bash
# Get vote count for poll 1, option 0
npm run interact -- get-tally 1 0
```

### Step 14: Finalize poll

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

---

## Script Reference

| Script | Command | Description |
|--------|---------|-------------|
| gen-identity | `npm run gen-identity` | Generate Semaphore identity |
| deploy | `npm run deploy` | Deploy all contracts |
| interact | `npm run interact -- <cmd>` | Contract interaction (see subcommands) |
| fetch-leaves | `npm run fetch-leaves -- <pollId>` | Fetch voter leaves for a poll |
| compute-root | `npm run compute-root` | Compute Merkle root from leaves |
| gen-proof | `npm run gen-proof` | Generate Semaphore ZK proof |
| format-calldata | `npm run format-calldata` | Format proof as Garaga calldata |
| finalize-poll | `npm run finalize-poll -- <pollId>` | Finalize poll and store winner |

### interact subcommands

| Subcommand | Usage |
|------------|-------|
| add-eligible | `npm run interact -- add-eligible <pollId> <address1> [address2 ...]` |
| register-commitment | `npm run interact -- register-commitment <pollId> <commitment>` |
| freeze-registry | `npm run interact -- freeze-registry <pollId>` |
| create-poll | `npm run interact -- create-poll <pollId> <optionsCount> <startTime> <endTime> <root>` |
| submit-vote | `npm run interact -- submit-vote <calldata.json>` |
| get-tally | `npm run interact -- get-tally <pollId> <option>` |
| finalize | `npm run interact -- finalize <pollId>` |
| get-poll | `npm run interact -- get-poll <pollId>` |
