# ZK Protocol: How Zero-Knowledge Proofs Work in StarkVote

This document explains in detail how zero-knowledge proofs enable anonymous voting in StarkVote — from the mathematical primitives to the on-chain verification logic.

## Table of Contents

1. [The Problem](#the-problem)
2. [ZK Proof Intuition](#zk-proof-intuition)
3. [How Semaphore, Garaga, and Worldcoin Fit Together](#how-semaphore-garaga-and-worldcoin-fit-together)
4. [Semaphore v4 Protocol](#semaphore-v4-protocol)
5. [Groth16 Proof System](#groth16-proof-system)
6. [Identity and Commitment](#identity-and-commitment)
7. [Merkle Tree Membership](#merkle-tree-membership)
8. [Scope, Signal, and Nullifier](#scope-signal-and-nullifier)
9. [Proof Generation (Off-Chain)](#proof-generation-off-chain)
10. [Proof Verification (On-Chain)](#proof-verification-on-chain)
11. [Garaga: Groth16 on Starknet](#garaga-groth16-on-starknet)
12. [Data Flow End-to-End](#data-flow-end-to-end)
13. [Security Analysis](#security-analysis)

---

## The Problem

In a traditional voting system, either:

- **Votes are public** — everyone knows who voted for what (no privacy).
- **Votes go through a trusted authority** — a central server counts ballots, but voters must trust it won't cheat or leak information.

StarkVote solves this with a third option:

- **Votes are anonymous and publicly verifiable** — a voter proves they belong to the eligible set and submits a vote, without revealing *which* member they are. Anyone can verify the proof is valid by checking the on-chain transaction.

This is made possible by **zero-knowledge proofs (ZKPs)**.

---

## ZK Proof Intuition

A zero-knowledge proof lets someone (the **prover**) convince someone else (the **verifier**) that a statement is true, without revealing *why* it's true.

In StarkVote, the statement being proven is:

> "I know a secret identity whose commitment is one of the leaves in a specific Merkle tree, and I'm voting for option X in poll Y."

The proof reveals:
- The Merkle root (which tree)
- A nullifier hash (prevents double-voting)
- The signal hash (which option)
- The scope hash (which poll)

The proof does **not** reveal:
- Which leaf (voter) in the tree
- The secret identity
- The Merkle path taken

---

## How Semaphore, Garaga, and Worldcoin Fit Together

StarkVote combines three existing projects, each solving a different piece of the puzzle:

### Semaphore — The ZK Protocol

[Semaphore](https://semaphore.pse.dev/) (by PSE / Ethereum Foundation) provides the core zero-knowledge protocol for anonymous group membership. StarkVote uses:

- **Semaphore v4 Circom circuit** (`semaphore30.wasm`, `semaphore30.zkey`) — the arithmetic circuit that encodes "I'm a member of this group and I'm voting for option X". The circuit uses Poseidon hashing for the Merkle tree and produces Groth16 proofs over the BN254 curve.
- **`@semaphore-protocol/identity`** — JavaScript library to generate voter identities (private key → Poseidon commitment).
- **`@semaphore-protocol/group`** — JavaScript library to build the depth-30 Poseidon Merkle tree and generate Merkle proofs.
- **`@semaphore-protocol/proof`** — Utility for packing Groth16 proof elements.
- **`snarkjs`** — The Groth16 prover that takes circuit inputs + WASM + zkey and outputs the proof.

Semaphore was originally designed for Ethereum. Its proofs are Groth16/BN254, which Ethereum can verify natively via the `ecPairing` precompile (EIP-197). **Starknet has no such precompile**, which is where Garaga comes in.

### Garaga — Groth16 Verification on Starknet

[Garaga](https://github.com/keep-starknet-strange/garaga) (by Keep Starknet Strange) is a Cairo library that enables BN254 elliptic curve operations on Starknet. Starknet natively operates over the Stark field (prime ~2^251), not BN254, so all the curve arithmetic must be emulated.

StarkVote uses Garaga in two ways:

1. **Contract generation** (`garaga gen`): Given a Groth16 verification key, Garaga generates a Cairo smart contract (`Groth16VerifierBN254`) that can verify proofs for that specific key. The contract bakes in the verification key constants (~4000 lines) and implements the BN254 pairing check. This is a ~2MB contract.

2. **Calldata generation** (npm package): Garaga's `getGroth16CallData()` takes a proof + verification key and produces optimized calldata (~1900 felt252 values). This calldata includes precomputed "hints" that make on-chain verification dramatically cheaper — instead of computing expensive Miller loops and final exponentiations on-chain, the contract only needs to verify that the precomputed hints are consistent. The `garaga` npm package ships a WASM build of the Rust implementation, so calldata generation runs in Node.js (or the browser) with no Python dependency.

```
Proof (8 numbers) + VK + Hints  →  ~1900 felt252 calldata  →  On-chain pairing check
```

### Worldcoin — The Interface Pattern

[Worldcoin](https://worldcoin.org/) was the first major project to deploy Semaphore-based Groth16 verification on Starknet using Garaga. Their on-chain verifier interface became a de facto standard:

```cairo
fn verify_groth16_proof_bn254(
    full_proof_with_hints: Span<felt252>
) -> Option<Span<u256>>
```

StarkVote adopts this same interface (hence `IWorldcoinVerifier` in our code). We don't use Worldcoin's identity system (World ID / iris scanning) — we use Semaphore's standard identity commitments instead. The "Worldcoin" naming in our verifier contract refers only to the interface pattern that Garaga/Worldcoin established.

### How They Connect

```
                    Off-chain                          On-chain (Starknet)

  Semaphore JS libs                           Garaga-generated contracts
 ┌───────────────────┐                       ┌──────────────────────────┐
 │ @semaphore/identity│ → commitment         │ Groth16VerifierBN254     │
 │ @semaphore/group   │ → Merkle tree/proof  │   (garaga gen output)    │
 │ snarkjs            │ → Groth16 proof      │   BN254 pairing check    │
 └────────┬──────────┘                       └────────────▲─────────────┘
          │                                               │
          ▼                                               │
 ┌───────────────────┐                       ┌────────────┴─────────────┐
 │ Garaga npm package │                       │ Semaphore30Verifier      │
 │   calldata gen     │ → 1900 felt252 ──────►│   (Worldcoin interface)  │
 │   (WASM)           │   with hints          │   wraps Garaga verifier  │
 └───────────────────┘                       └────────────▲─────────────┘
                                                          │
                                              ┌───────────┴─────────────┐
                                              │ Poll contract            │
                                              │   checks public inputs   │
                                              │   records tally          │
                                              └─────────────────────────┘
```

### Why This Combination?

| Decision | Rationale |
|----------|-----------|
| **Semaphore v4** | Battle-tested anonymous group membership protocol with trusted setup already completed. No need to write our own ZK circuit. |
| **Groth16/BN254** | Semaphore's proof system. Proofs are tiny (~128 bytes) and verification is fast, but requires a trusted setup. |
| **Garaga** | The only production-ready way to verify BN254 proofs on Starknet. Without it, we'd need a different proof system entirely. |
| **Worldcoin interface** | Reuses a proven pattern for passing Groth16 proofs to Starknet contracts. Compatible with Garaga's calldata format. |
| **Depth 30** | Supports ~1 billion voters. Semaphore's PSE team provides precomputed trusted setup artifacts for this depth. |

---

## Semaphore v4 Protocol

[Semaphore](https://semaphore.pse.dev/) is a generic ZK protocol for anonymous group signaling, developed by the Privacy & Scaling Explorations (PSE) team at the Ethereum Foundation. StarkVote uses Semaphore v4.

Semaphore provides:

1. **Anonymous group membership** — prove you're in a group without revealing who you are.
2. **Signal binding** — attach a message (vote option) to the proof.
3. **Nullifier-based rate limiting** — each identity can only signal once per "scope" (poll).

### The Semaphore Circuit

The Semaphore v4 circuit is a Groth16 arithmetic circuit written in Circom. It takes these inputs:

**Private inputs** (known only to the prover):
| Input | Description |
|-------|-------------|
| `secret` | The voter's secret scalar (derived from private key) |
| `merkleProofSiblings[30]` | 30 sibling hashes along the Merkle path |
| `merkleProofIndex` | Bit-encoded path (left/right at each level) |
| `merkleProofLength` | Actual depth of the leaf in the tree |

**Public inputs** (visible to everyone, including the on-chain verifier):
| Input | Description |
|-------|-------------|
| `merkleRoot` | Root of the Merkle tree containing all voter commitments |
| `nullifierHash` | `Poseidon(secret, scope)` — unique per identity+poll |
| `signalHash` | `semaphoreHash(option)` — the vote choice |
| `externalNullifier` (scope) | `semaphoreHash(poll_id)` — identifies which poll |

The circuit verifies:
1. `commitment = Poseidon(secret)` — the prover knows the preimage of a commitment.
2. The commitment exists at the specified position in the Merkle tree with the given root.
3. `nullifierHash = Poseidon(secret, scope)` — the nullifier is correctly derived.

If all constraints are satisfied, the prover can produce a valid proof. The verifier only sees the public inputs and the proof — never the secret or the Merkle path.

---

## Groth16 Proof System

Semaphore uses [Groth16](https://eprint.iacr.org/2016/260), a zk-SNARK proof system. Key properties:

| Property | Description |
|----------|-------------|
| **Zero-knowledge** | The proof reveals nothing about private inputs |
| **Succinct** | The proof is constant size (~128 bytes) regardless of computation complexity |
| **Non-interactive** | No back-and-forth between prover and verifier |
| **Trusted setup** | Requires a one-time ceremony to generate proving/verification keys |

### Trusted Setup

Groth16 requires a **trusted setup ceremony** that produces:
- **Proving key** (`.zkey`, ~1.5GB for depth 30) — used by the prover to generate proofs.
- **Verification key** (`.json`, ~3KB) — used by the verifier to check proofs.

Semaphore's trusted setup was conducted by the PSE team through a multi-party computation (MPC) ceremony. The security assumption is that at least one participant was honest (and deleted their toxic waste). The artifacts are publicly available at `snark-artifacts.pse.dev`.

### Proof Structure

A Groth16 proof consists of three elliptic curve points on the BN254 curve:
- `A` ∈ G1 (2 field elements)
- `B` ∈ G2 (4 field elements — a point on the twisted curve)
- `C` ∈ G1 (2 field elements)

Verification checks a pairing equation:
```
e(A, B) = e(α, β) · e(L, γ) · e(C, δ)
```

Where `α, β, γ, δ` are from the verification key, and `L` encodes the public inputs. This pairing check is what happens inside the Garaga verifier on Starknet.

---

## Identity and Commitment

### Identity Generation

A Semaphore v4 identity is created from a random private key:

```
secret_scalar = derive(random_private_key)
commitment = Poseidon(secret_scalar)
```

The `commitment` is a public value — it's what gets stored on-chain as a leaf in the Merkle tree. The `secret_scalar` must remain private; anyone with it can impersonate the voter.

### In StarkVote

```typescript
// gen_identity_commitment.ts
const identity = new Identity();         // random private key
identity.commitment;                      // → public commitment (u256)
identity.secretScalar;                    // → private (never shared)
```

The poll creator whitelists eligible wallet addresses per poll, then each voter self-registers their commitment:
```
VoterSetRegistry.add_eligible_batch(poll_id, [addr0, addr1, ...])  // poll creator whitelists
VoterSetRegistry.register_commitment(poll_id, commitment)           // voter self-registers as leaves[i]
```

---

## Merkle Tree Membership

### Why a Merkle Tree?

A Merkle tree lets us prove membership in a set using only `O(log n)` data, without revealing *which* element we're proving. With depth 30, StarkVote supports up to 2^30 (~1 billion) voters.

### Tree Structure

```
                    Root
                   /    \
                 H01     H23
                / \     / \
              H0   H1  H2  H3
              |    |    |    |
             L0   L1   L2   ...    ← voter commitments (leaves)
```

- **Hash function**: Poseidon (SNARK-friendly, ~8x cheaper than SHA-256 inside a circuit)
- **Leaf**: `leaves[i] = commitment_i`
- **Internal node**: `H(left, right) = Poseidon(left, right)`
- **Empty leaves**: Filled with `0` up to `2^30` entries

### Merkle Proof

To prove leaf `L1` is in the tree, the prover provides:
- The sibling at each level: `[L0, H23, ...]`
- The path direction at each level (left or right): encoded in `merkleProofIndex`

The verifier (inside the circuit) recomputes the root from the leaf and siblings:
```
H01 = Poseidon(L0, L1)      ← L1 is right child, sibling is L0
Root = Poseidon(H01, H23)   ← H01 is left child, sibling is H23
```

If the recomputed root matches the public input `merkleRoot`, the leaf is in the tree. The verifier never learns *which* leaf — only that some leaf hashes up to the root.

### In StarkVote

The tree is built off-chain from on-chain data:

```typescript
// compute_merkle_root.ts
const leaves = [/* fetched from VoterSetRegistry */];
const group = new Group(leaves);          // builds Poseidon Merkle tree
const root = group.root;                  // matches what circuit will check
const proof = group.generateMerkleProof(leafIndex);
// proof.siblings = [sibling0, sibling1, ..., sibling29]
```

---

## Scope, Signal, and Nullifier

These three values bind the proof to a specific action and prevent abuse.

### Scope (External Nullifier)

The **scope** identifies what context the proof is for. In StarkVote:

```
scope = semaphoreHash(poll_id)
```

This means each poll is a separate "namespace". The same voter can vote in multiple polls but only once per poll.

### Signal (Message)

The **signal** is the message being signed. In StarkVote:

```
signal = semaphoreHash(option)
```

This binds the vote option to the proof. The contract verifies that the signal in the proof matches the option being voted for.

### Nullifier

The **nullifier** is a deterministic value derived from the voter's secret and the scope:

```
nullifier_hash = Poseidon(secret_scalar, scope)
```

Properties:
- **Deterministic**: Same identity + same poll always produces the same nullifier.
- **Unlinkable**: Different polls produce different nullifiers for the same voter.
- **One-way**: Knowing the nullifier reveals nothing about the identity.

The contract stores `used_nullifiers[(poll_id, nullifier_hash)]` and rejects any proof that produces a previously-seen nullifier.

### semaphoreHash

Semaphore v4 hashes scope and signal values using a keccak-based function:

```
semaphoreHash(value) = keccak256(zeroPadValue(toBeHex(value), 32)) >> 8
```

The `>> 8` (right-shift by 8 bits) reduces the 256-bit hash to 248 bits so it fits within the BN254 scalar field (which has ~254-bit order but requires values < field modulus).

**Cairo implementation** (note the endianness correction):

```cairo
fn semaphore_hash(value: u256) -> u256 {
    let raw = core::keccak::keccak_u256s_be_inputs(array![value].span());
    // Cairo keccak syscall returns bytes in little-endian order
    // Ethereum keccak256 uses big-endian, so we must reverse
    let hash = u256 {
        low: core::integer::u128_byte_reverse(raw.high),
        high: core::integer::u128_byte_reverse(raw.low),
    };
    hash / 256_u256  // equivalent to >> 8
}
```

This was a critical bug fix — without the byte reversal, the on-chain hash doesn't match the off-chain hash, causing every proof to be rejected with "scope mismatch".

---

## Proof Generation (Off-Chain)

The voter generates a proof locally using `snarkjs` (a JavaScript Groth16 implementation).

### Inputs Preparation

```typescript
// gen_proof.ts
const { proof, publicSignals } = await groth16.fullProve(
  {
    secret: identity.secretScalar,          // private: voter's secret
    merkleProofLength: proof.siblings.length,
    merkleProofIndex: proof.index,           // private: path in tree
    merkleProofSiblings: siblings,           // private: 30 sibling hashes
    scope: semaphoreHash(pollId).toString(), // public: which poll
    message: semaphoreHash(option).toString(), // public: which option
  },
  "semaphore30.wasm",    // circuit compiled to WASM
  "semaphore30.zkey"     // proving key from trusted setup
);
```

### Output

Two files are produced:

**`proof.json`** — The Groth16 proof (8 field elements encoding points A, B, C):
```json
[
  "11098113672249664958...",   // A.x
  "14274584625449902037...",   // A.y
  "5782486417337619506...",    // B[0].x
  ...
]
```

**`public.json`** — The 4 public signals:
```json
{
  "publicSignals": [
    "4809233...",   // [0] merkleRoot
    "1844231...",   // [1] nullifierHash
    "9283745...",   // [2] signalHash (option)
    "7234561..."    // [3] scopeHash (poll_id)
  ]
}
```

### Calldata Formatting

The proof and public signals must be formatted for Garaga's on-chain verifier. This is done using the `garaga` npm package (WASM build of Garaga's Rust code):

```typescript
// gen_calldata.ts
import { init, getGroth16CallData, CurveId } from "garaga";

await init();
const calldata = getGroth16CallData(proof, vk, CurveId.BN254);
const calldataNoPrefix = calldata.slice(1);  // strip Garaga's length prefix
```

The output `worldcoin_calldata.json` contains ~1900 felt252 values — the proof, public inputs, and precomputed "hints" that make on-chain verification cheaper (avoiding expensive computations during the pairing check). Because this uses WASM, it can run in Node.js or in the browser with no Python dependency.

---

## Proof Verification (On-Chain)

When a voter calls `Poll.vote()`, the contract performs these checks:

### Step 1: Groth16 Verification

```
Poll → Semaphore30Verifier → Groth16VerifierBN254 (Garaga)
```

The calldata flows through three contracts:

1. **Poll** receives `(poll_id, option, full_proof_with_hints)` from the voter.
2. **Semaphore30Verifier** forwards the proof to the Garaga verifier.
3. **Groth16VerifierBN254** performs the BN254 elliptic curve pairing check.

If the pairing equation holds, Garaga returns the 4 verified public inputs. If not, verification fails and the transaction reverts.

### Step 2: Public Input Validation

After Garaga confirms the proof is mathematically valid, the Poll contract checks that the public inputs match the expected values:

```cairo
// Extract verified public inputs
let pi_root = verified_public_inputs[0];       // merkleRoot
let pi_nullifier = verified_public_inputs[1];  // nullifierHash
let pi_signal = verified_public_inputs[2];     // signalHash
let pi_scope = verified_public_inputs[3];      // scopeHash

// 1. Root must match the poll's snapshot
assert(*pi_root == poll.snapshot_root, 'Root mismatch');

// 2. Scope must be hash of this poll_id
assert(*pi_scope == semaphore_hash(poll_id), 'Public input scope mismatch');

// 3. Signal must be hash of the voted option
assert(*pi_signal == semaphore_hash(option), 'Public input signal mismatch');

// 4. Nullifier must not have been used before
assert(!used_nullifiers[(poll_id, nullifier_hash)], 'Nullifier already used');
```

### Step 3: Record Vote

If all checks pass:
```cairo
used_nullifiers[(poll_id, nullifier_hash)] = true;
tally[(poll_id, option)] += 1;
emit Voted { poll_id, nullifier_hash, option };
```

---

## Garaga: Groth16 on Starknet

[Garaga](https://github.com/keep-starknet-strange/garaga) is a library that enables Groth16 proof verification on Starknet. This is non-trivial because:

1. **BN254 is not native to Starknet** — Starknet operates over the Stark field (prime ~2^251), while Groth16 uses the BN254 curve (different prime ~2^254). All BN254 arithmetic must be emulated.

2. **Pairing checks are expensive** — Verifying a Groth16 proof requires computing bilinear pairings over elliptic curves, involving Miller loops and final exponentiations.

### How Garaga Makes It Feasible

Garaga uses a **hints-based approach**:

- The heavy computation (Miller loop, final exponentiation) is done off-chain by the calldata generator (Garaga WASM).
- The off-chain code produces "hints" — intermediate values that the on-chain verifier can cheaply check rather than recompute.
- The on-chain contract (~2MB due to precomputed constants from the verification key) validates that the hints are consistent and the pairing equation holds.

This reduces on-chain gas from infeasible to ~300,000 steps.

### Contract Generation

The `Groth16VerifierBN254` contract is generated by running:

```bash
garaga gen --vk verification_key30.json --system groth16
```

This bakes the verification key (curve points `α, β, γ, δ` and input commitments) into the contract as constants. A different verification key requires generating a new verifier contract.

### Calldata Format

Garaga's `groth16_calldata_from_vk_and_proof()` produces an array of felt252 values:

```
[length, proof_data..., hints_data..., public_inputs...]
```

**Important**: The first element is a length prefix. Since `starknet.js` adds its own `Span` length when serializing arrays, the prefix must be stripped to avoid a double-length error:

```typescript
const calldataNoPrefix = calldata.slice(1);
```

---

## Data Flow End-to-End

```
┌─── SETUP (one-time) ─────────────────────────────────────────────────┐
│                                                                       │
│  Deployer deploys contracts:                                         │
│    Groth16VerifierBN254 ← generated from verification_key30.json     │
│    Semaphore30Verifier  ← wraps Groth16VerifierBN254                 │
│    VoterSetRegistry     ← empty                                      │
│    Poll                 ← linked to Registry + Verifier              │
│                                                                       │
│  Poll creator whitelists eligible addresses for poll:                │
│    VoterSetRegistry.add_eligible_batch(poll_id, [addr0, addr1, ...]) │
│                                                                       │
│  Each voter generates identity + self-registers for poll:            │
│    secret_scalar → commitment = Poseidon(secret_scalar)              │
│    VoterSetRegistry.register_commitment(poll_id, commitment)         │
│    (called from voter's eligible wallet address)                     │
│                                                                       │
│  Poll creator freezes the voter set for poll:                        │
│    VoterSetRegistry.freeze(poll_id)                                  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌─── POLL CREATION (per poll) ──────────────────────────────────────────┐
│                                                                       │
│  Poll creator creates poll with snapshot of voter set:               │
│    root = compute_merkle_root(all_leaves)                            │
│    Poll.create_poll(poll_id, options_count, start, end, root)        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌─── VOTING (per voter) ────────────────────────────────────────────────┐
│                                                                       │
│  1. Fetch leaves from VoterSetRegistry                               │
│  2. Build Merkle tree, find own leaf, compute proof path             │
│  3. Prepare circuit inputs:                                          │
│       private: { secret, siblings[30], pathIndex }                   │
│       public:  { root, nullifier, signalHash, scopeHash }           │
│  4. Generate Groth16 proof (snarkjs + wasm + zkey)                   │
│  5. Format calldata (Garaga WASM library)                            │
│  6. Submit transaction:                                              │
│       Poll.vote(poll_id, option, full_proof_with_hints)              │
│                                                                       │
│  On-chain:                                                           │
│    Garaga verifies pairing equation                    ✓ or ✗        │
│    Poll checks root == snapshot_root                   ✓ or ✗        │
│    Poll checks scope == semaphoreHash(poll_id)         ✓ or ✗        │
│    Poll checks signal == semaphoreHash(option)         ✓ or ✗        │
│    Poll checks nullifier not used                      ✓ or ✗        │
│    → tally[poll_id][option] += 1                                     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌─── RESULTS ───────────────────────────────────────────────────────────┐
│                                                                       │
│  Anyone can read: Poll.get_tally(poll_id, option)                    │
│  After end_time:  Poll.finalize(poll_id) → stores winner on-chain    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Security Analysis

### What Makes Votes Anonymous?

1. **The Merkle proof is private** — the circuit proves a leaf exists in the tree without revealing which one.
2. **The nullifier is unlinkable** — `Poseidon(secret, scope)` produces a different value for each poll, so nullifiers from different polls cannot be correlated.
3. **The transaction sender is irrelevant** — anyone can submit the proof on behalf of the voter (the proof itself is the authorization, not the transaction sender).

### What Prevents Cheating?

| Attack | Prevention |
|--------|------------|
| **Vote twice** | Nullifier is deterministic per identity+poll. Second vote produces same nullifier → rejected. |
| **Vote in wrong poll** | Scope hash is checked: `scopeHash == semaphoreHash(poll_id)`. A proof generated for poll 1 cannot be used in poll 2. |
| **Vote for wrong option** | Signal hash is checked: `signalHash == semaphoreHash(option)`. The proof commits to a specific option. |
| **Forge a proof** | Without knowing a valid `secret_scalar`, the prover cannot satisfy the circuit constraints. Groth16 is computationally binding. |
| **Use non-member identity** | The Merkle root is checked against `snapshot_root`. A proof with a root that doesn't match the on-chain snapshot is rejected. |
| **Modify voter set mid-poll** | The registry is frozen before the poll. `snapshot_root` is fixed at poll creation time. |
| **Front-run/replay proofs** | The nullifier makes each proof unique per identity+poll. Replaying it hits "Nullifier already used". |

### Trust Assumptions

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| **Semaphore circuit** | Trusted | Open-source, audited, widely deployed |
| **Groth16 trusted setup** | Trust-minimized | MPC ceremony — only 1 honest participant needed |
| **Garaga verifier** | Trusted | Open-source, Starknet-specific implementation |
| **Poll creator** | Semi-trusted | Controls voter set (auditable) but cannot forge votes or break anonymity |
| **Starknet L2** | Trusted for liveness | If the sequencer censors, votes cannot be submitted (but privacy is still preserved) |

### Known Limitations

- **Voter set curated by poll creator**: The poll creator decides which wallet addresses are eligible per poll. However, each voter self-registers their own cryptographic commitment, so the poll creator never handles secret key material. The eligible set and all registered commitments are publicly auditable on-chain.
- **No receipt-freeness**: A voter who reveals their secret can prove how they voted, enabling coercion/vote-selling. This is inherent to all Semaphore-based schemes.
- **Trusted setup**: Groth16 requires the ceremony. If all participants colluded (or the toxic waste was leaked), fake proofs could be created. In practice, this is considered safe for Semaphore's widely-participated ceremony.
- **Transaction metadata**: While the vote content is anonymous, the transaction sender's address is visible. For full anonymity, voters should use a fresh account or have someone else submit their proof.
