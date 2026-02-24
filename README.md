# StarkVote

> *On every blockchain today, your vote is public. Your wallet is permanently linked to your choice — visible to anyone, forever. StarkVote changes that.*

StarkVote is a fully on-chain anonymous voting system built on Starknet. Voters prove they are eligible and cast their ballot — without anyone, including the organizer, being able to see how they voted or even that they voted.

No trusted server. No privacy middleman. Just math.

## Why this is hard

**Most "private" voting systems are private in name only.** They encrypt votes and trust a server to decrypt them honestly. That just moves the problem — someone still has the key.

StarkVote has no such escape hatch. Eligibility is proven with a zero-knowledge proof using [Semaphore v4](https://semaphore.pse.dev/): you convince the contract you belong to the voter list without revealing which entry is yours. No operator, no oracle, no trusted decryptor.

Making this work fully on-chain in Cairo required integrating [Garaga](https://github.com/keep-starknet-strange/garaga) — a Cairo-native Groth16 BN254 verifier — and bridging the cryptographic gap between Semaphore's proof format and Cairo's execution model. The result: **proof verification is entirely on-chain, trustless, and permanent.**


| Contract | Address |
|---|---|
| Groth16VerifierBN254 | `0x7b36d8d96916d4353b70982e6781c5f1373487bafc0afa60f433f1545346a68` |
| Semaphore30Verifier | `0x549185d992ed265a0fb3fb17eea5e7ee753ea02c8d6b4608f6c83ae895d4dd5` |
| VoterSetRegistry | `0x524442ab0c7bae6a9a0ce2b00ac6d621b9502c454ffdc204c9b48a2c37a68c` |
| Poll | `0x5789a8b8844df95cd10689b3d5f2273ab4e769a4e5c1c6f062749e0d47aab73` |


## How it works

**1. Registration** — The organizer whitelists eligible wallet addresses. Each voter self-registers a *commitment* (a fingerprint of their secret identity, revealing nothing about them) on-chain. The list is then frozen.

**2. Voting** — The voter's device generates a ZK proof:
> *"I know a secret matching one of the commitments in this voter list, and I vote for option X."*

The proof is submitted with a one-time *nullifier* that prevents double-voting. The contract verifies the proof on-chain and records the vote.

**3. Results** — After the poll closes, anyone triggers the tally. The winner is computed and stored on-chain. All votes are counted. No vote is traceable.

## Tech stack

| Layer | Technology |
|---|---|
| Blockchain | Starknet Sepolia |
| Smart contracts | Cairo (Scarb 2.14.0) |
| ZK proofs | Semaphore v4 — Groth16 BN254 |
| On-chain verifier | Garaga v1.0.1 |
| Off-chain scripts | TypeScript / Node.js |

## Docs

| | |
|---|---|
| Manual testing guide | [docs/TESTING.md](docs/TESTING.md) |
| Protocol architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| ZK proof details | [docs/ZK_PROTOCOL.md](docs/ZK_PROTOCOL.md) |
