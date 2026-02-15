# StarkVote Flow Diagram

Visual representation of contract calls and script usage.

---

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: DEPLOYMENT                          │
└─────────────────────────────────────────────────────────────────┘

Admin:
  │
  ├─► Deploy VoterSetRegistry(admin_address)
  │   └─► Deployed at: REGISTRY_ADDRESS
  │
  └─► Deploy Poll(admin, REGISTRY_ADDRESS, WORLDCOIN_VERIFIER)
      └─► Deployed at: POLL_ADDRESS

WorldCoin Verifier (already deployed):
  └─► 0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a


┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 2: VOTER REGISTRATION                     │
└─────────────────────────────────────────────────────────────────┘

Voter 1:
  │
  └─► npm run gen-identity
      └─► Creates: .local/identity1.json (SECRET!)
      └─► Output: commitment1
      └─► Share commitment1 with admin

Voter 2:
  │
  └─► npm run gen-identity
      └─► Creates: .local/identity2.json
      └─► Output: commitment2
      └─► Share commitment2 with admin

Voter 3:
  │
  └─► npm run gen-identity
      └─► Creates: .local/identity3.json
      └─► Output: commitment3
      └─► Share commitment3 with admin

Admin:
  │
  ├─► registry.add_voter(commitment1)
  │   └─► Stored at leaves[0]
  │
  ├─► registry.add_voter(commitment2)
  │   └─► Stored at leaves[1]
  │
  ├─► registry.add_voter(commitment3)
  │   └─► Stored at leaves[2]
  │
  └─► registry.freeze()
      └─► Registry locked, no more voters can be added


┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 3: POLL CREATION                        │
└─────────────────────────────────────────────────────────────────┘

Admin:
  │
  ├─► npm run fetch-leaves
  │   └─► Reads: registry.get_leaf_count() = 3
  │   └─► Reads: registry.get_leaf(0), get_leaf(1), get_leaf(2)
  │   └─► Creates: .local/leaves.json
  │       └─► Contains: [commitment1, commitment2, commitment3]
  │
  ├─► npm run compute-root
  │   └─► Reads: .local/leaves.json
  │   └─► Builds Merkle tree (depth 30, BN254 field)
  │   └─► Computes: root = hash(tree)
  │   └─► Creates: .local/merkle_root.json
  │       └─► Contains: root in BN254 field
  │
  └─► poll.create_poll(
        poll_id: 1,
        options_count: 3,
        start_time: <now>,
        end_time: <now + 24h>,
        merkle_root: <root from compute-root>
      )
      └─► Poll created with snapshot of voter set


┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 4: VOTING (Voter 1)                    │
└─────────────────────────────────────────────────────────────────┘

Voter 1:
  │
  ├─► npm run fetch-leaves
  │   └─► Creates: .local/leaves.json (same as admin)
  │
  ├─► Create: .local/proof_config.json
  │   └─► { poll_id: 1, option: 0, leaf_index: 0 }
  │
  ├─► cp .local/identity1.json .local/identity.json
  │   └─► Load Voter 1's identity
  │
  ├─► npm run gen-proof
  │   └─► Reads: .local/identity.json, .local/leaves.json, .local/proof_config.json
  │   └─► Builds Merkle tree (depth 30)
  │   └─► Computes Merkle proof for leaf_index=0
  │   └─► Generates ZK proof using Semaphore circuit
  │   │   └─► Proves: "I know identity at leaves[0]"
  │   │   └─► Without revealing: which identity
  │   └─► Creates: samples/proof.json (ZK proof)
  │   └─► Creates: samples/public.json (public signals)
  │       └─► [root, nullifier_hash, signal, scope]
  │
  ├─► npm run format-calldata
  │   └─► Reads: samples/proof.json, samples/public.json
  │   └─► Formats for Starknet
  │   └─► Creates: samples/calldata.json
  │
  └─► poll.vote(
        poll_id: 1,
        option: 0,
        root: <from calldata>,
        nullifier_hash: <from calldata>,
        signal: <from calldata>,
        proof: <8 elements from calldata>,
        public_inputs: <4 elements from calldata>
      )
      │
      └─► Poll contract checks:
          │
          ├─► 1. Poll exists? ✓
          ├─► 2. Time valid? (start <= now <= end) ✓
          ├─► 3. Option valid? (0 <= option < 3) ✓
          ├─► 4. Root matches? (root == snapshot_root) ✓
          ├─► 5-9. Public inputs match parameters? ✓
          ├─► 10. Nullifier not used? ✓
          │
          ├─► 11. Call WorldCoin verifier:
          │      verifier.verify(proof, public_inputs)
          │      └─► Verifies ZK proof cryptographically ✓
          │
          └─► All checks passed!
              │
              ├─► Record nullifier (poll_id, nullifier_hash) => used
              ├─► Increment tally: tally[(1, 0)] += 1
              └─► Emit Voted event


┌─────────────────────────────────────────────────────────────────┐
│                PHASE 5: VOTING (Voter 2 & 3)                    │
└─────────────────────────────────────────────────────────────────┘

Voter 2:
  │
  ├─► .local/proof_config.json: { poll_id: 1, option: 1, leaf_index: 1 }
  ├─► cp .local/identity2.json .local/identity.json
  ├─► npm run gen-proof
  ├─► npm run format-calldata
  └─► poll.vote(...) with option: 1
      └─► tally[(1, 1)] += 1

Voter 3:
  │
  ├─► .local/proof_config.json: { poll_id: 1, option: 0, leaf_index: 2 }
  ├─► cp .local/identity3.json .local/identity.json
  ├─► npm run gen-proof
  ├─► npm run format-calldata
  └─► poll.vote(...) with option: 0
      └─► tally[(1, 0)] += 1

Final tallies:
  ├─► tally[(1, 0)] = 2  (Voter 1 + Voter 3)
  ├─► tally[(1, 1)] = 1  (Voter 2)
  └─► tally[(1, 2)] = 0  (no votes)


┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 6: FINALIZATION                        │
└─────────────────────────────────────────────────────────────────┘

Anyone (after end_time):
  │
  └─► poll.finalize(poll_id: 1)
      │
      ├─► Check poll ended: now > end_time ✓
      ├─► Check not already finalized ✓
      │
      ├─► Compute winner:
      │   ├─► option 0: 2 votes
      │   ├─► option 1: 1 vote
      │   ├─► option 2: 0 votes
      │   └─► Winner: option 0 (argmax)
      │
      ├─► Update poll:
      │   ├─► finalized = true
      │   ├─► winner_option = 0
      │   └─► max_votes = 2
      │
      └─► Emit PollFinalized event

Anyone:
  │
  └─► poll.get_poll(1)
      └─► Returns: [exists, options, times, root, finalized=true, winner=0, votes=2]


┌─────────────────────────────────────────────────────────────────┐
│              PHASE 7: DOUBLE-VOTING PREVENTION                  │
└─────────────────────────────────────────────────────────────────┘

Voter 1 (tries to vote again):
  │
  ├─► cp .local/identity1.json .local/identity.json
  ├─► .local/proof_config.json: { poll_id: 1, option: 2, leaf_index: 0 }
  ├─► npm run gen-proof
  ├─► npm run format-calldata
  │
  └─► poll.vote(...)
      │
      └─► Poll contract checks:
          │
          ├─► Steps 1-9: All pass ✓
          │
          ├─► 10. Nullifier not used?
          │      └─► used_nullifiers[(1, nullifier_hash)] == true
          │      └─► ❌ FAIL: "Nullifier already used"
          │
          └─► Transaction reverted ✓ (Double-voting prevented!)
```

---

## Data Flow Summary

```
Identity Generation (Off-Chain):
  Identity → [trapdoor, nullifier] → Commitment
  └─► Share commitment only (public)

Merkle Tree (Off-Chain):
  Commitments → Poseidon hash (BN254) → Root
  └─► Use root for poll creation

ZK Proof Generation (Off-Chain):
  Identity + Merkle proof → Semaphore circuit → ZK proof
  └─► Proves membership without revealing which member

Vote Verification (On-Chain):
  ZK proof + public inputs → WorldCoin verifier → Valid/Invalid
  └─► If valid: record vote + nullifier

Anonymity:
  Commitment (public) + Nullifier (public) + Vote (public)
  └─► Cannot link back to Identity (secret)
```

---

## Key Insights

### Why Off-Chain Root Computation?

```
Problem: Cairo Poseidon ≠ Semaphore Poseidon (different fields)

Solution:
  1. Store commitments on-chain (no hashing)
  2. Compute root off-chain (Semaphore's Poseidon in BN254)
  3. Admin provides root when creating poll
  4. Voters compute same root off-chain
  5. ZK proofs match this root
  6. WorldCoin verifier checks proofs (BN254 field)
```

### Why Depth 30?

```
WorldCoin's verifier expects depth 30
  └─► Our circuit must match: depth 30
      └─► Supports 2^30 = 1 billion voters
      └─► Proof generation: ~5-10 seconds
      └─► Proof size: ~2.5 KB
```

### Why Nullifiers?

```
Without nullifiers:
  └─► Same identity could generate different proofs for same poll
      └─► Vote multiple times

With nullifiers:
  └─► nullifier_hash = hash(identity, poll_id)
      └─► Same for every proof from same identity in same poll
      └─► Contract tracks: used_nullifiers[(poll_id, nullifier_hash)]
      └─► Second vote with same nullifier: rejected
```

---

## Contract Call Sequence

```
Deployment:
  1. deploy VoterSetRegistry
  2. deploy Poll

Registration:
  3. registry.add_voter(commitment) × N
  4. registry.freeze()

Poll Creation:
  5. registry.get_leaf_count()
  6. registry.get_leaf(i) for all i
  7. [off-chain: compute root]
  8. poll.create_poll(..., root)

Voting:
  9. [off-chain: fetch leaves]
  10. [off-chain: generate proof]
  11. poll.vote(proof, public_inputs)
  12. poll.get_tally(poll_id, option)

Finalization:
  13. poll.finalize(poll_id)
  14. poll.get_poll(poll_id)
```

---

## File Dependencies

```
Deployment:
  → contracts/target/dev/*.contract_class.json

Identity Generation:
  → Creates: .local/identity.json (SECRET!)

Voter Registration:
  → Requires: commitments from identities
  → On-chain: registry contract

Merkle Root:
  → Requires: .local/leaves.json
  → Creates: .local/merkle_root.json

Poll Creation:
  → Requires: .local/merkle_root.json
  → On-chain: poll contract

Proof Generation:
  → Requires: .local/identity.json
  → Requires: .local/leaves.json
  → Requires: .local/proof_config.json
  → Requires: node_modules/@zk-kit/semaphore-artifacts/semaphore-30.*
  → Creates: samples/proof.json
  → Creates: samples/public.json

Vote Submission:
  → Requires: samples/calldata.json
  → On-chain: poll contract + worldcoin verifier
```

---

**Use this diagram with TESTING_GUIDE.md for complete understanding!**
