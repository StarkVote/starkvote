/**
 * Compute Merkle Root (Off-Chain)
 *
 * Computes the Merkle tree root from all voter commitments.
 * Uses Semaphore's Poseidon hash (BN254 field) - depth 30.
 *
 * This root is needed by admin when creating a poll.
 * It represents the snapshot of eligible voters.
 *
 * Prerequisites: .local/leaves.json (from fetch-leaves)
 * Output: .local/merkle_root.json (root in BN254 field)
 * Usage: npm run compute-root
 */
import { poseidon2 } from "poseidon-lite";
import * as fs from "fs";
import * as path from "path";

const TREE_DEPTH = 30; // Matches WorldCoin's verifier

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
}

async function main() {
    // Load leaves
    const leavesData = JSON.parse(
        fs.readFileSync('.local/leaves.json', 'utf-8')
    );
    const leaves = leavesData.leaves.map((l: string) => BigInt(l));

    console.log(`Computing Merkle root for ${leaves.length} leaves (depth ${TREE_DEPTH})`);

    // Build tree
    const tree = new MerkleTree(TREE_DEPTH, leaves);
    const root = tree.getRoot();

    console.log(`Root: ${root}`);
    console.log(`Root (hex): 0x${root.toString(16)}`);

    // Save to .local/merkle_root.json
    fs.writeFileSync(
        '.local/merkle_root.json',
        JSON.stringify({
            root: root.toString(),
            root_hex: '0x' + root.toString(16),
            leaf_count: leaves.length,
            depth: TREE_DEPTH,
            timestamp: new Date().toISOString()
        }, null, 2)
    );

    console.log('✅ Root saved to .local/merkle_root.json');
}

main().catch(console.error);
