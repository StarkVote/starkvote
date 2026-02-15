# StarkVote Testing Guide - Sepolia Testnet

Complete step-by-step guide for manual testing on Starknet Sepolia using TypeScript scripts.

---

## Prerequisites

- [ ] Starknet wallet with Sepolia ETH ([Get from faucet](https://starknet-faucet.vercel.app/))
- [ ] Node.js 18+ installed
- [ ] Your wallet private key

---

## Phase 1: Setup (10 minutes)

### 1.1 Install Dependencies

```bash
cd zk
npm install
```

**Expected output:**
```
added 150 packages, and audited 151 packages in 15s
```

### 1.2 Configure Environment

Create `zk/.env` file:

```bash
cat > .env << 'EOF'
ADMIN_ADDRESS=0x1234...abcd
PRIVATE_KEY=0x5678...ef01
RPC_URL=https://starknet-sepolia.public.blastapi.io
EOF
```

**Replace with your actual values:**
- `ADMIN_ADDRESS` - Your wallet address
- `PRIVATE_KEY` - Your wallet private key (keep secret!)
- `RPC_URL` - Sepolia RPC endpoint (default shown above)

### 1.3 Build Contracts

```bash
cd ../contracts
scarb build
```

**Expected output:**
```
Compiling starkvote v0.1.0
Finished release target(s) in 2 seconds
```

---

## Phase 2: Deploy Contracts (5 minutes)

### 2.1 Deploy with WorldCoin's Verifier (Recommended)

```bash
cd ../zk
npm run deploy
```

**This will:**
1. Deploy VoterSetRegistry
2. Use WorldCoin's verifier (no deployment needed)
3. Deploy Poll contract
4. Save addresses to `.local/contract_addresses.json`

**Expected output:**
```
╔══════════════════════════════════════════╗
║   StarkVote Deployment                   ║
╚══════════════════════════════════════════╝

📋 Configuration:
   Admin:    0x1234...abcd
   Network:  Sepolia (https://starknet-sepolia.public.blastapi.io)
   Verifier: WorldCoin (production)

📦 Loading contract artifacts...

🚀 Deploying VoterSetRegistry...
   ✅ Deployed at: 0x05d7...892a

✅ Using WorldCoin's verifier: 0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a

🚀 Deploying Poll...
   ✅ Deployed at: 0x03a1...45bc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Deployment Complete!

📋 Contract Addresses:
   Registry: 0x05d7...892a
   Verifier: 0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a (WorldCoin)
   Poll:     0x03a1...45bc

💾 Saved to: .local/contract_addresses.json
```

### 2.2 Alternative: Deploy with MockVerifier (Testing Only)

If you want to test contract logic without real proofs:

```bash
npm run deploy -- --mock-verifier
```

**This deploys MockVerifier instead of using WorldCoin's.**

### 2.3 Verify Deployment

```bash
cat .local/contract_addresses.json
```

**Expected structure:**
```json
{
  "network": "sepolia",
  "deployed_at": "2026-02-15T...",
  "admin_address": "0x1234...abcd",
  "registry_address": "0x05d7...892a",
  "verifier_address": "0x01167d...",
  "verifier_type": "WorldCoin",
  "poll_address": "0x03a1...45bc",
  "transaction_hashes": {
    "registry": "0x...",
    "verifier": "N/A (using WorldCoin)",
    "poll": "0x..."
  }
}
```

---

## Phase 3: Register Voters (20 minutes)

### 3.1 Generate Identity for Voter 1

```bash
npm run gen-identity
```

**Expected output:**
```
✅ Identity generated!
Commitment: 12345678901234567890123456789012345678901234567890

⚠️  IMPORTANT: Keep .local/identity.json SECRET!
📋 Share only the commitment with the admin to register as a voter.
```

**Save the commitment!** Example: `commitment1 = 12345...`

**Backup identity:**
```bash
cp .local/identity.json .local/identity1.json
```

### 3.2 Generate Identities for Voter 2 & 3

```bash
# Voter 2
npm run gen-identity
cp .local/identity.json .local/identity2.json
# Save commitment2

# Voter 3
npm run gen-identity
cp .local/identity.json .local/identity3.json
# Save commitment3
```

### 3.3 Create interact.ts Script for Contract Calls

Create `zk/scripts/interact.ts` (or update existing):

```typescript
#!/usr/bin/env tsx

import { config } from "dotenv";
import { Account, RpcProvider, Contract, cairo } from "starknet";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const addresses = JSON.parse(
  readFileSync(join(__dirname, "../.local/contract_addresses.json"), "utf-8")
);

const RPC_URL = process.env.RPC_URL || "https://starknet-sepolia.public.blastapi.io";
const provider = new RpcProvider({ nodeUrl: RPC_URL });

const account = new Account({
  provider: provider,
  address: process.env.ADMIN_ADDRESS!,
  signer: process.env.PRIVATE_KEY!
});

// Load ABIs
const registryAbi = JSON.parse(
  readFileSync(join(__dirname, "../../contracts/target/dev/starkvote_VoterSetRegistry.sierra.json"), "utf-8")
).abi;

const pollAbi = JSON.parse(
  readFileSync(join(__dirname, "../../contracts/target/dev/starkvote_Poll.sierra.json"), "utf-8")
).abi;

const registry = new Contract(registryAbi, addresses.registry_address, account);
const poll = new Contract(pollAbi, addresses.poll_address, account);

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case "add-voter":
      await addVoter(args[0]);
      break;
    case "freeze":
      await freezeRegistry();
      break;
    case "create-poll":
      await createPoll(args[0], args[1], args[2], args[3], args[4]);
      break;
    case "vote":
      await submitVote(args[0]);
      break;
    case "tally":
      await getTally(args[0], args[1]);
      break;
    case "finalize":
      await finalizePoll(args[0]);
      break;
    case "get-poll":
      await getPoll(args[0]);
      break;
    default:
      console.log("Usage:");
      console.log("  tsx interact.ts add-voter <commitment>");
      console.log("  tsx interact.ts freeze");
      console.log("  tsx interact.ts create-poll <poll_id> <options> <start> <end> <root>");
      console.log("  tsx interact.ts vote <calldata_file>");
      console.log("  tsx interact.ts tally <poll_id> <option>");
      console.log("  tsx interact.ts finalize <poll_id>");
      console.log("  tsx interact.ts get-poll <poll_id>");
  }
}

async function addVoter(commitment: string) {
  console.log(`Adding voter with commitment: ${commitment}`);
  const tx = await registry.add_voter(commitment);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`✅ Voter added! TX: ${tx.transaction_hash}`);
}

async function freezeRegistry() {
  console.log("Freezing registry...");
  const tx = await registry.freeze();
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`✅ Registry frozen! TX: ${tx.transaction_hash}`);
}

async function createPoll(pollId: string, options: string, start: string, end: string, root: string) {
  console.log(`Creating poll ${pollId} with ${options} options`);
  const tx = await poll.create_poll(
    cairo.uint256(pollId),
    parseInt(options),
    cairo.uint256(start),
    cairo.uint256(end),
    root
  );
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`✅ Poll created! TX: ${tx.transaction_hash}`);
}

async function submitVote(calldataFile: string) {
  const calldata = JSON.parse(readFileSync(calldataFile, "utf-8"));
  console.log(`Submitting vote for poll ${calldata.poll_id}, option ${calldata.option}`);

  const tx = await poll.vote(
    cairo.uint256(calldata.poll_id),
    calldata.option,
    calldata.root,
    calldata.nullifier_hash,
    calldata.signal,
    calldata.proof_flat,
    calldata.public_inputs
  );

  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`✅ Vote submitted! TX: ${tx.transaction_hash}`);
}

async function getTally(pollId: string, option: string) {
  const tally = await poll.get_tally(cairo.uint256(pollId), parseInt(option));
  console.log(`Tally for poll ${pollId}, option ${option}: ${tally}`);
}

async function finalizePoll(pollId: string) {
  console.log(`Finalizing poll ${pollId}...`);
  const tx = await poll.finalize(cairo.uint256(pollId));
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`✅ Poll finalized! TX: ${tx.transaction_hash}`);
}

async function getPoll(pollId: string) {
  const pollData = await poll.get_poll(cairo.uint256(pollId));
  console.log(`Poll ${pollId} data:`, pollData);
}

main().catch(console.error);
```

Make it executable:
```bash
chmod +x scripts/interact.ts
```

### 3.4 Add Voters to Registry

```bash
tsx scripts/interact.ts add-voter <commitment1>
tsx scripts/interact.ts add-voter <commitment2>
tsx scripts/interact.ts add-voter <commitment3>
```

**Replace `<commitment1>` etc. with actual commitments from step 3.1-3.2**

**Expected output (for each):**
```
Adding voter with commitment: 12345...
✅ Voter added! TX: 0x0abc...
```

### 3.5 Freeze Registry

```bash
tsx scripts/interact.ts freeze
```

**Expected output:**
```
Freezing registry...
✅ Registry frozen! TX: 0x0def...
```

---

## Phase 4: Create Poll (15 minutes)

### 4.1 Fetch Leaves from Registry

```bash
npm run fetch-leaves
```

**Expected output:**
```
📡 Fetching leaves from registry: 0x05d7...
Frozen: true
Leaf count: 3
Leaf 0: 12345...
Leaf 1: 67890...
Leaf 2: 11111...
✅ Saved 3 leaves to .local/leaves.json
```

### 4.2 Compute Merkle Root (Off-Chain)

```bash
npm run compute-root
```

**Expected output:**
```
Computing Merkle root for 3 leaves (depth 30)
Root: 987654321098765432109876543210987654321098765432109876543210
Root (hex): 0xabc123...def456
✅ Root saved to .local/merkle_root.json
```

**Save the root_hex value!**

### 4.3 Create Poll

**Get current timestamp:**
```bash
date +%s
```

Example: `1707984000`

**Calculate end time (24 hours later):**
```bash
echo $(($(date +%s) + 86400))
```

Example: `1708070400`

**Create poll:**
```bash
tsx scripts/interact.ts create-poll \
  1 \
  3 \
  1707984000 \
  1708070400 \
  <root_hex_from_step_4.2>
```

**Parameters:**
- `1` - poll_id
- `3` - options_count (options 0, 1, 2)
- `1707984000` - start_time
- `1708070400` - end_time
- `<root_hex>` - from merkle_root.json

**Expected output:**
```
Creating poll 1 with 3 options
✅ Poll created! TX: 0x0xyz...
```

---

## Phase 5: Vote (Voter 1) (10 minutes)

### 5.1 Prepare Proof Configuration

```bash
cat > .local/proof_config.json << 'EOF'
{
  "poll_id": 1,
  "option": 0,
  "leaf_index": 0
}
EOF
```

### 5.2 Load Voter 1 Identity & Generate Proof

```bash
cp .local/identity1.json .local/identity.json
npm run gen-proof
```

**Expected output:**
```
Tree depth: 30
Root: 987654321098765432109876543210987654321098765432109876543210
✅ Proof generated for depth 30
📁 Output: samples/proof.json, samples/public.json
```

**This takes ~5-10 seconds**

### 5.3 Format Calldata

```bash
npm run format-calldata
```

**Expected output:**
```
✅ Calldata formatted for Starknet
📁 Output: samples/calldata.json
```

### 5.4 Submit Vote

```bash
tsx scripts/interact.ts vote samples/calldata.json
```

**Expected output:**
```
Submitting vote for poll 1, option 0
✅ Vote submitted! TX: 0x0vote...
```

### 5.5 Verify Vote Recorded

```bash
tsx scripts/interact.ts tally 1 0
```

**Expected output:**
```
Tally for poll 1, option 0: 1
```

---

## Phase 6: Vote (Voter 2 & 3) (20 minutes)

### 6.1 Voter 2 - Vote for Option 1

```bash
# Update config
cat > .local/proof_config.json << 'EOF'
{
  "poll_id": 1,
  "option": 1,
  "leaf_index": 1
}
EOF

# Load identity and generate proof
cp .local/identity2.json .local/identity.json
npm run gen-proof
npm run format-calldata

# Submit vote
tsx scripts/interact.ts vote samples/calldata.json

# Verify
tsx scripts/interact.ts tally 1 1
```

**Expected:** `Tally for poll 1, option 1: 1`

### 6.2 Voter 3 - Vote for Option 0

```bash
# Update config
cat > .local/proof_config.json << 'EOF'
{
  "poll_id": 1,
  "option": 0,
  "leaf_index": 2
}
EOF

# Load identity and generate proof
cp .local/identity3.json .local/identity.json
npm run gen-proof
npm run format-calldata

# Submit vote
tsx scripts/interact.ts vote samples/calldata.json
```

### 6.3 Check All Tallies

```bash
tsx scripts/interact.ts tally 1 0  # Should be 2
tsx scripts/interact.ts tally 1 1  # Should be 1
tsx scripts/interact.ts tally 1 2  # Should be 0
```

---

## Phase 7: Finalize Poll (5 minutes)

### 7.1 Wait for End Time

Check if poll has ended (current time > end_time).

### 7.2 Finalize and Check Winner

```bash
tsx scripts/interact.ts finalize 1
tsx scripts/interact.ts get-poll 1
```

**Expected output:**
```
Poll 1 data: {
  exists: true,
  options_count: 3,
  start_time: 1707984000,
  end_time: 1708070400,
  snapshot_root: 0xabc123...,
  finalized: true,
  winner_option: 0,
  max_votes: 2
}
```

**Winner is option 0 with 2 votes!** ✅

---

## Phase 8: Test Double-Voting Prevention (5 minutes)

```bash
# Try voting again with Voter 1
cp .local/identity1.json .local/identity.json

cat > .local/proof_config.json << 'EOF'
{
  "poll_id": 1,
  "option": 2,
  "leaf_index": 0
}
EOF

npm run gen-proof
npm run format-calldata
tsx scripts/interact.ts vote samples/calldata.json
```

**Expected error:**
```
Error: Execution failed
Reason: Nullifier already used
```

**This is correct!** ✅

---

## Verification Checklist

- [ ] ✅ Contracts deployed via TypeScript script
- [ ] ✅ 3 identities generated
- [ ] ✅ 3 voters added to registry
- [ ] ✅ Registry frozen
- [ ] ✅ Merkle root computed off-chain
- [ ] ✅ Poll created with correct root
- [ ] ✅ Voter 1 voted for option 0
- [ ] ✅ Voter 2 voted for option 1
- [ ] ✅ Voter 3 voted for option 0
- [ ] ✅ Tallies: Option 0 = 2, Option 1 = 1, Option 2 = 0
- [ ] ✅ Winner determined: Option 0
- [ ] ✅ Double-voting prevented

---

## Troubleshooting

### "Missing ADMIN_ADDRESS or PRIVATE_KEY"
**Solution:** Create `zk/.env` with your wallet details (see Phase 1.2)

### "Account balance" error
**Solution:** Get Sepolia ETH from faucet: https://starknet-faucet.vercel.app/

### "Root mismatch"
**Solution:**
1. Verify you used root from `merkle_root.json`
2. Ensure `leaves.json` was fetched AFTER freezing
3. Don't modify registry after freezing

### "Proof verification failed"
**Solution:**
1. Verify WorldCoin's verifier address is correct
2. Check proof generated with depth 30
3. Verify `leaf_index` is correct (0 to count-1)

---

## Summary

You've successfully tested StarkVote using TypeScript scripts:

1. ✅ Deployed contracts with `npm run deploy`
2. ✅ Registered voters
3. ✅ Created poll with off-chain root
4. ✅ Generated and verified ZK proofs
5. ✅ Recorded anonymous votes
6. ✅ Determined winner
7. ✅ Prevented double-voting

**All via convenient TypeScript scripts!** 🎉

---

## Quick Reference

```bash
# Deployment
npm run deploy                              # Deploy with WorldCoin verifier
npm run deploy -- --mock-verifier           # Deploy with MockVerifier

# Identity
npm run gen-identity                        # Generate identity

# Registry
tsx scripts/interact.ts add-voter <commitment>
tsx scripts/interact.ts freeze

# Poll Creation
npm run fetch-leaves
npm run compute-root
tsx scripts/interact.ts create-poll <id> <opts> <start> <end> <root>

# Voting
npm run gen-proof
npm run format-calldata
tsx scripts/interact.ts vote samples/calldata.json

# Results
tsx scripts/interact.ts tally <poll_id> <option>
tsx scripts/interact.ts finalize <poll_id>
tsx scripts/interact.ts get-poll <poll_id>
```

---

**Ready to test!** Follow the guide step-by-step. 🚀
