/**
 * Compute Semaphore-compatible Merkle root off-chain (depth 30).
 *
 * Input:
 * - .local/leaves.json
 *
 * Output:
 * - .local/merkle_root.json
 */
import { Group } from "@semaphore-protocol/group";
import * as fs from "fs";

const TREE_DEPTH = 30;

async function main() {
  const leavesData = JSON.parse(fs.readFileSync(".local/leaves.json", "utf-8"));
  const leaves = leavesData.leaves.map((leaf: string) => BigInt(leaf));

  const group = new Group(leaves);
  const root = BigInt(group.root.toString());

  const payload = {
    root: root.toString(),
    root_hex: `0x${root.toString(16)}`,
    leaf_count: leaves.length,
    depth: TREE_DEPTH,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(".local/merkle_root.json", JSON.stringify(payload, null, 2));

  console.log(`Computed root for ${leaves.length} leaves at depth ${TREE_DEPTH}`);
  console.log(`Root: ${payload.root}`);
  console.log(`Root (hex): ${payload.root_hex}`);
  console.log("Saved .local/merkle_root.json");
}

main().catch(console.error);
