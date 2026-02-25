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
npm run download-artifacts
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

## Phase 2: Voter Registration

Each poll has its own independent voter set. The first caller to `add-eligible` for a given `poll_id` becomes its admin. Complete all steps in this phase before creating the poll.

### Step 3: Add eligible addresses (poll creator)

```bash
# The first call for poll 3 makes the caller its admin
npm run interact -- add-eligible 3 <your-wallet-address>
```

### Step 4: Register commitment (each voter)

Each eligible voter self-registers their Semaphore commitment. Use the commitment printed in Step 1:

```bash
COMMITMENT=$(jq -r '.commitment' ./.local/identity.json)
npm run interact -- register-commitment 3 $COMMITMENT
```

### Step 5: Freeze voter set

```bash
npm run interact -- freeze-registry 3
```

**Permanently locks the voter set for poll 3. Only the poll admin can freeze. Must be done before creating the poll.**

---

## Phase 3: Poll Creation

### Step 6: Fetch on-chain leaves

```bash
npm run fetch-leaves -- 3
```

Reads all committed leaves for poll 3 from the registry. Saved to `zk/.local/leaves.json`.

### Step 7: Compute Merkle root

```bash
npm run compute-root
```

Builds the depth-30 Poseidon Merkle tree from the leaves. Saved to `zk/.local/merkle_root.json`.

### Step 8: Create poll

```bash
START=$(( $(date +%s) - 60 ))
END=$(( $(date +%s) + 300 ))
ROOT=$(jq -r '.root' ./.local/merkle_root.json)

npm run interact -- create-poll 3 2 $START $END $ROOT "Alice" "Bob"
```

- `3` — poll ID
- `2` — number of options (must match the number of labels)
- `$START / $END` — Unix timestamps; `start` slightly in the past so voting is immediately open
- `"Alice" "Bob"` — candidate names stored on-chain for UI display only, not part of the ZK proof

---

## Phase 4: Voting

### Step 9: Create proof config

Create `zk/.local/proof_config.json`:

```json
{
  "poll_id": 3,
  "option": 0,
  "leaf_index": 0
}
```

- `poll_id` — must match the poll created in Step 8
- `option` — 0-indexed option to vote for (0 = Alice, 1 = Bob)
- `leaf_index` — index of your commitment in the leaves list from Step 6

### Step 10: Generate ZK proof

```bash
npm run gen-proof
```

Generates the Semaphore Groth16 proof. Outputs `zk/samples/proof.json` and `zk/samples/public.json`.

### Step 11: Format calldata for Garaga

```bash
npm run format-calldata
```

Converts the proof into Garaga-compatible calldata. Outputs `zk/samples/worldcoin_calldata.json`.

### Step 12: Submit vote

```bash
npm run interact -- submit-vote samples/worldcoin_calldata.json
```

Submits the vote transaction with the ZK proof. The contract verifies the proof on-chain.

---

## Phase 5: Results

### Step 13: Check tally

```bash
# Votes for option 0 (Alice)
npm run interact -- get-tally 3 0

# Votes for option 1 (Bob)
npm run interact -- get-tally 3 1
```

### Step 14: Read candidate labels

```bash
# All labels at once (returns { "0": "Alice", "1": "Bob" })
npm run interact -- get-option-labels 3

# Single label
npm run interact -- get-option-label 3 0
```

### Step 15: Finalize poll

After `end_time` has passed, anyone can finalize the poll to compute and store the winner on-chain:

```bash
npm run interact -- finalize 3

# View full poll data including winner
npm run interact -- get-poll 3
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
| download-artifacts | `npm run download-artifacts` | Download Semaphore30 wasm/zkey artifacts |

### interact subcommands

| Subcommand | Usage |
|------------|-------|
| add-eligible | `npm run interact -- add-eligible <pollId> <address1> [address2 ...]` |
| register-commitment | `npm run interact -- register-commitment <pollId> <commitment>` |
| freeze-registry | `npm run interact -- freeze-registry <pollId>` |
| create-poll | `npm run interact -- create-poll <pollId> <optionsCount> <startTime> <endTime> <root> <label0> <label1> ...` |
| submit-vote | `npm run interact -- submit-vote <calldata.json>` |
| get-tally | `npm run interact -- get-tally <pollId> <option>` |
| get-option-label | `npm run interact -- get-option-label <pollId> <option>` |
| get-option-labels | `npm run interact -- get-option-labels <pollId>` |
| finalize | `npm run interact -- finalize <pollId>` |
| get-poll | `npm run interact -- get-poll <pollId>` |
