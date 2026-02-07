# StarkVote Protocol Architecture

This document describes the final StarkVote architecture: anonymous voting/signaling on Starknet using Semaphore-style membership proofs, with an admin-published voter set and publicly verifiable results.

---

## Overview

StarkVote provides:

- **Eligibility**: only members of a pre-published voter set can vote.
- **Anonymity**: votes cannot be linked to a specific voter.
- **One vote per poll**: enforced via poll-scoped nullifiers.
- **Public verifiability**: everyone can audit the voter set, poll configuration, and tallies.
- **Deterministic winner**: winner is computed from on-chain tallies after poll end.

The protocol uses a Merkle-tree-based voter set and membership proofs. The voter set is stored on-chain (leaves), so anyone can reconstruct membership paths and verify the root.

---

## Roles

### Admin (Organizer)
- Publishes the eligible voter set on-chain as identity commitments.
- Freezes the voter set (locks it and commits to a root).
- Creates polls that snapshot the frozen root.
- Optionally finalizes a poll to store the winner on-chain.

### Voter
- Creates a private identity locally.
- Derives an `identity_commitment` (public).
- Votes by submitting a transaction with a membership proof, a poll-scoped nullifier, and a signal (option).

### Observer
- Audits the voter set (leaves + root).
- Audits polls (snapshot root, time window, options).
- Reads tallies and computes the winner.

---

## Data Model

### Voter Set
- `leaf[i] = identity_commitment_i`
- Leaves are stored on-chain.
- The Merkle tree has fixed depth (e.g., 20). Missing leaves are zero-padded.
- The registry stores the final `root` after freezing.

### Poll
A poll is defined by:
- `poll_id`: unique identifier
- `options_count`: number of valid options
- `start_time`, `end_time`: voting window
- `snapshot_root`: the frozen voter-set root used for eligibility

### Scope, Signal, and Nullifier
- `scope = poll_id` (external nullifier)
- `signal = option` (or `hash(message)` for signaling mode)
- `nullifier_hash = f(identity, scope)` (derived inside the proof)

The poll contract stores:
- `used_nullifiers[(poll_id, nullifier_hash)] = true` once a vote is accepted.

---

## Public Verifiability

Because leaves are stored on-chain:
- Anyone can read `leaf[i]` values and see the published eligible set.
- Anyone can recompute the Merkle root from leaves and verify it matches the frozen `root`.
- Any voter can reconstruct their Merkle path locally using on-chain leaves (no off-chain indexer needed, especially with <50 voters).

---

## Steps [1..6]

## [1] Publish voter commitments (Admin)
1. Each voter generates a private identity locally.
2. Each voter computes a public `identity_commitment`.
3. Admin publishes the eligible commitments on-chain (one-by-one or batch).
4. The registry stores them as sequential leaves: `leaf[0..n-1]`.

**Public audit**: anyone can read leaves and verify the published eligible set.

---

## [2] Freeze voter set (Admin)
1. Admin calls `freeze()` on the registry.
2. Registry becomes immutable (no more leaves can be added/modified).
3. Registry computes the Merkle root from stored leaves (padding with zeros to the full tree size).
4. Registry stores `root` and emits `Frozen(root, leaf_count)`.

**Public audit**: anyone can recompute the root from on-chain leaves and verify it equals the stored `root`.

---

## [3] Create poll with snapshot root (Admin)
1. Admin calls `create_poll(poll_id, options_count, start_time, end_time)`.
2. Poll reads the registry’s frozen `root`.
3. Poll stores `snapshot_root = root`.
4. Poll defines `scope = poll_id` for proof verification.

This ensures the eligibility set is fixed for the entire poll.

---

## [4] Generate membership path and proof (Voter, off-chain)
1. Voter reads `leaf[0..n-1]` from the registry.
2. Voter reconstructs the Merkle tree locally and identifies his leaf index.
3. Voter computes Merkle path siblings for that index.
4. Voter chooses `option`.
5. Voter sets:
   - `scope = poll_id`
   - `signal = option`
6. Voter generates:
   - `nullifier_hash` (identity + scope)
   - `proof` attesting membership and correct nullifier/signal binding
7. Voter prepares public inputs in the required order:
   - `[root, nullifier_hash, signal, scope]`

---

## [5] Submit vote transaction (Voter, on-chain)
Voter calls `vote(...)` on the Poll contract, providing:
- `poll_id`
- `option`
- `root`
- `nullifier_hash`
- `signal`
- `proof`
- `public_inputs`

---

## [6] Verify, record, and determine winner (On-chain + Observers)

### On-chain vote acceptance
When processing `vote`, the Poll contract checks:
1. Poll exists and is active: `start_time <= now <= end_time`
2. `option < options_count`
3. `root == snapshot_root`
4. `scope == poll_id`
5. `used_nullifiers[(poll_id, nullifier_hash)] == false`
6. Proof verifies against public inputs `[root, nullifier_hash, signal, scope]`

If all checks pass:
- `used_nullifiers[(poll_id, nullifier_hash)] = true`
- `tally[(poll_id, option)] += 1`
- emit `Voted(poll_id, nullifier_hash, option)`

### Final results and winner
After `now > end_time`, anyone can determine the winner by reading tallies:

1. Read `options_count`.
2. For each `option in [0, options_count - 1]`, read `tally[(poll_id, option)]`.
3. Compute:
   - `winner_option = argmax(tally)`
   - tie-break: **lowest option index wins** (deterministic)

#### Optional finalize
Optionally, add a `finalize(poll_id)` function:
- requires `now > end_time`
- computes winner from tallies
- stores `winner_option` and `max_votes`
- sets `finalized = true`
- emits `PollFinalized(poll_id, winner_option, max_votes)`

Finalization is optional because tallies are already authoritative; it simply makes “who won” easy to query.

---

## Notes

- Admin cannot forge votes without a voter’s secret identity, but can omit a voter during publication. This is fully auditable because the leaf list is public.
- Snapshotting the frozen root at poll creation prevents changing eligibility during voting.
- Privacy holds because on-chain state never includes the voter’s identity—only a proof and a poll-scoped nullifier.
