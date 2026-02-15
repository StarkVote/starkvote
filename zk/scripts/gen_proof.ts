/**
 * Generate ZK Proof
 *
 * Generates a Semaphore ZK proof proving:
 * - You're in the Merkle tree (eligible voter)
 * - Without revealing which leaf is yours (anonymity)
 *
 * The proof can be verified on-chain by WorldCoin's verifier.
 *
 * Prerequisites:
 * - .local/identity.json (your identity)
 * - .local/leaves.json (all commitments from registry)
 * - .local/proof_config.json (poll_id, option, leaf_index)
 *
 * Output:
 * - samples/proof.json (ZK proof)
 * - samples/public.json (public signals)
 *
 * Usage: npm run gen-proof
 */
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { poseidon2 } from "poseidon-lite";
import * as fs from "fs";
import * as path from "path";

// TREE DEPTH 30 (matches WorldCoin's verifier)
const TREE_DEPTH = 30;

// MerkleTree class for depth 30
class MerkleTree {
    depth: number;
    leaves: bigint[];
    zeros: bigint[];

    constructor(depth: number, leaves: bigint[]) {
        this.depth = depth;
        this.leaves = leaves;

        // Precompute zero hashes
        this.zeros = [];
        this.zeros[0] = BigInt(0);
        for (let i = 1; i <= depth; i++) {
            this.zeros[i] = poseidon2([this.zeros[i-1], this.zeros[i-1]]);
        }
    }

    getRoot(): bigint {
        const maxLeaves = 2 ** this.depth;
        let level = [...this.leaves];

        // Pad with zeros
        while (level.length < maxLeaves) {
            level.push(this.zeros[0]);
        }

        // Build tree bottom-up
        for (let i = 0; i < this.depth; i++) {
            const nextLevel: bigint[] = [];
            for (let j = 0; j < level.length; j += 2) {
                const left = level[j];
                const right = level[j + 1] || this.zeros[i];
                nextLevel.push(poseidon2([left, right]));
            }
            level = nextLevel;
        }

        return level[0];
    }

    getProof(index: number): bigint[] {
        const proof: bigint[] = [];
        const maxLeaves = 2 ** this.depth;
        let level = [...this.leaves];

        while (level.length < maxLeaves) {
            level.push(this.zeros[0]);
        }

        let idx = index;
        for (let i = 0; i < this.depth; i++) {
            const siblingIdx = idx ^ 1;
            proof.push(level[siblingIdx] || this.zeros[i]);

            const nextLevel: bigint[] = [];
            for (let j = 0; j < level.length; j += 2) {
                const left = level[j];
                const right = level[j + 1] || this.zeros[i];
                nextLevel.push(poseidon2([left, right]));
            }
            level = nextLevel;
            idx = Math.floor(idx / 2);
        }

        return proof;
    }
}

async function main() {
    // Load identity
    const identityData = JSON.parse(
        fs.readFileSync('.local/identity.json', 'utf-8')
    );
    const identity = new Identity(identityData.serialized);

    // Load leaves
    const leavesData = JSON.parse(
        fs.readFileSync('.local/leaves.json', 'utf-8')
    );
    const leaves = leavesData.leaves.map((l: string) => BigInt(l));

    // Load config
    const config = JSON.parse(
        fs.readFileSync('.local/proof_config.json', 'utf-8')
    );

    // Verify identity commitment matches
    const commitment = identity.commitment;
    if (leaves[config.leaf_index] !== commitment) {
        throw new Error('Commitment mismatch!');
    }

    // Build tree (depth 30)
    const tree = new MerkleTree(TREE_DEPTH, leaves);
    const root = tree.getRoot();
    const proof = tree.getProof(config.leaf_index);

    console.log(`Tree depth: ${TREE_DEPTH}`);
    console.log(`Root: ${root}`);

    // Generate ZK proof
    const fullProof = await generateProof(
        identity,
        { depth: TREE_DEPTH, members: leaves },
        config.poll_id,  // external nullifier (scope)
        config.option,   // signal
        {
            wasmFilePath: path.join(__dirname, '../node_modules/@zk-kit/semaphore-artifacts/semaphore-30.wasm'),
            zkeyFilePath: path.join(__dirname, '../node_modules/@zk-kit/semaphore-artifacts/semaphore-30.zkey')
        }
    );

    // Ensure samples directory exists
    const samplesDir = path.join(__dirname, '../samples');
    if (!fs.existsSync(samplesDir)) {
        fs.mkdirSync(samplesDir, { recursive: true });
    }

    // Save proof
    fs.writeFileSync(
        path.join(samplesDir, 'proof.json'),
        JSON.stringify(fullProof.proof, null, 2)
    );

    fs.writeFileSync(
        path.join(samplesDir, 'public.json'),
        JSON.stringify({
            publicSignals: fullProof.publicSignals,
            root: root.toString(),
            depth: TREE_DEPTH
        }, null, 2)
    );

    console.log('✅ Proof generated for depth 30');
    console.log(`📁 Output: samples/proof.json, samples/public.json`);
}

main().catch(console.error);
