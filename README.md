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
| Groth16VerifierBN254 | `0x1e887ebf03a47de3e22cae4892c13da338e9d4a860b994abbafacdc77874951` |
| Semaphore30Verifier | `0x54df8c3ccfa7f2383c37765c0ac2b76f5b039066eff832dd934945415e687ff` |
| VoterSetRegistry | `0x45a71bd1975fabda91c6b74850472b4cf5f7e9fd163603f1e6602500fb42411` |
| Poll | `0x380953626f285190c62dadb3f26886e70b5ba82f4ccc815718534912cdb1efc` |


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
