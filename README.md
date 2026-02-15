# StarkVote

Anonymous voting on Starknet using ZK proofs + WorldCoin's verifier.

---

## What You Get

- ✅ Anonymous voting (votes can't be linked to voters)
- ✅ One vote per poll (enforced with nullifiers)
- ✅ Free verification (use WorldCoin's deployed verifier)
- ✅ Works on Sepolia testnet now

---

## Quick Start

### 1. Install Dependencies

```bash
cd zk
npm install

cd ../contracts
scarb build
```

### 2. Deploy Contracts

Create `zk/.env`:
```bash
ADMIN_ADDRESS=0x...
PRIVATE_KEY=0x...
RPC_URL=https://starknet-sepolia.public.blastapi.io
```

**Deploy all contracts:**
```bash
cd zk
npm run deploy
```

**This automatically:**
- Deploys VoterSetRegistry
- Uses WorldCoin's verifier (free!)
- Deploys Poll contract
- Saves addresses to `.local/contract_addresses.json`

**Alternative (with MockVerifier):**
```bash
npm run deploy -- --mock-verifier
```

### 3. Complete Voting Flow

**Generate identity:**
```bash
cd zk
npm run gen-identity
# Share the commitment with admin
```

**Admin adds voters and freezes:**
```bash
registry.add_voter(<commitment1>)
registry.add_voter(<commitment2>)
registry.freeze()
```

**Compute Merkle root (off-chain):**
```bash
npm run fetch-leaves    # Get commitments from registry
npm run compute-root    # Compute root in BN254 field
# Copy the root value
```

**Admin creates poll:**
```bash
poll.create_poll(
  poll_id: 1,
  options_count: 2,
  start_time: <now>,
  end_time: <now + 86400>,
  merkle_root: <root_from_compute-root>
)
```

**Voters generate proofs and vote:**
```bash
# Create proof config
echo '{"poll_id": 1, "option": 0, "leaf_index": 0}' > .local/proof_config.json

npm run gen-proof         # Generate ZK proof (depth 30)
npm run format-calldata   # Format for Starknet

# Submit vote using samples/calldata.json
poll.vote(...)
```

**Check results:**
```bash
poll.get_tally(1, 0)    # Check votes
poll.finalize(1)        # After end_time
poll.get_poll(1)        # See winner
```

---

## Files Structure

```
contracts/src/
├── voter_set_registry.cairo  # Stores voter commitments
├── verifier.cairo             # IVerifier interface + MockVerifier
└── poll.cairo                 # Poll management + voting

zk/scripts/
├── gen_identity_commitment.ts # Generate voter identity
├── fetch_leaves.ts            # Read commitments from registry
├── compute_merkle_root.ts     # Compute root off-chain
├── gen_proof.ts               # Generate ZK proof (depth 30)
└── format_calldata.ts         # Format for Starknet
```

---

## Important Notes

### WorldCoin's Verifier (Sepolia)

**Address:** `0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a`

- Already deployed and working
- Free to use (no deployment cost)
- Requires tree depth 30 (our setup uses this)
- Battle-tested in production

### MockVerifier (Optional)

The `MockVerifier` contract is included for **optional quick testing**:
- Always returns `true` (no real verification)
- Useful to test contract logic without generating proofs
- Deploy Poll with MockVerifier address to use it
- For production, always use WorldCoin's verifier

**To test with MockVerifier:**
1. Deploy MockVerifier
2. Deploy Poll with MockVerifier address (instead of WorldCoin's)
3. Test voting with dummy proofs

**To test with real proofs:** Deploy Poll with WorldCoin's address (recommended)

### Tree Depth 30

All scripts use tree depth 30 to match WorldCoin's verifier:
- Supports up to 2^30 = 1 billion voters
- Proof generation takes ~5-10 seconds
- Proof size ~2.5KB

### Off-Chain Merkle Root

The Merkle root is computed **off-chain** using Semaphore's Poseidon (BN254 field):
1. Admin adds voters on-chain (just stores commitments)
2. Admin freezes registry
3. Admin computes root off-chain with `compute-root`
4. Admin creates poll with that root
5. Voters generate proofs matching the same root

---

## Configuration Files

Create these in `zk/.local/`:

**contract_addresses.json:**
```json
{
  "registry_address": "0x...",
  "poll_address": "0x..."
}
```

**proof_config.json:**
```json
{
  "poll_id": 1,
  "option": 0,
  "leaf_index": 0
}
```

These are generated automatically:
- `identity.json` - YOUR SECRET (never commit!)
- `leaves.json` - All commitments
- `merkle_root.json` - Computed root

---

## npm Scripts

```bash
npm run gen-identity      # Generate Semaphore identity
npm run fetch-leaves      # Fetch commitments from registry
npm run compute-root      # Compute Merkle root (depth 30)
npm run gen-proof         # Generate ZK proof
npm run format-calldata   # Format for Starknet
npm run export-vk         # Export verification key
```

---

## Troubleshooting

**"Root mismatch"**
- Use the root from `compute-root` output
- Verify leaves.json matches registry state

**"Nullifier already used"**
- Each identity votes once per poll
- Use different identity or new poll

**"Proof verification failed"**
- Verify using depth 30 artifacts
- Check leaf_index is correct (0 to count-1)
- Ensure poll_id matches

**"Index out of bounds"**
- leaf_index must be valid (check leaves.json count)

---

## Security

**Keep Secret:**
- `.local/identity.json` - Your private keys

**Share Publicly:**
- Your commitment (from identity.json)
- Merkle root (for poll creation)
- Vote tallies (on-chain)

**Anonymity:**
- Votes can't be linked to voters
- ZK proof proves membership without revealing which member
- Nullifiers prevent double-voting without revealing identity

---

## Architecture

See `docs/ARCHITECTURE.md` for complete protocol design.

---

**Ready to test!** 🚀

Deploy contracts → Generate identities → Add voters → Create poll → Vote → Check results
