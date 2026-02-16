/**
 * Generate a Semaphore proof for a vote.
 *
 * Prerequisites:
 * - .local/identity.json
 * - .local/leaves.json
 * - .local/proof_config.json
 *
 * Output:
 * - samples/proof.json
 * - samples/public.json
 */
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { packGroth16Proof } from "@semaphore-protocol/proof";
import { keccak256, toBeHex, zeroPadValue } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { groth16 } from "snarkjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TREE_DEPTH = 30;

function semaphoreHash(value: bigint): bigint {
  const padded = zeroPadValue(toBeHex(value), 32);
  return BigInt(keccak256(padded)) >> 8n;
}

function resolveSnarkArtifacts() {
  const artifactsDir = path.join(__dirname, "../artifacts");
  const wasm = path.join(artifactsDir, "semaphore30.wasm");
  const zkey = path.join(artifactsDir, "semaphore30.zkey");

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    throw new Error(
      [
        "Missing Semaphore30 artifacts in zk/artifacts.",
        "Expected files:",
        "  - artifacts/semaphore30.wasm",
        "  - artifacts/semaphore30.zkey",
        "Run: npm run download-artifacts",
      ].join("\n")
    );
  }

  return { wasm, zkey };
}

async function main() {
  const identityData = JSON.parse(fs.readFileSync(".local/identity.json", "utf-8"));
  const identity = Identity.import(identityData.serialized);

  const leavesData = JSON.parse(fs.readFileSync(".local/leaves.json", "utf-8"));
  const leaves = leavesData.leaves.map((leaf: string) => BigInt(leaf));

  const config = JSON.parse(fs.readFileSync(".local/proof_config.json", "utf-8"));
  const pollId = BigInt(config.poll_id);
  const option = BigInt(config.option);
  const leafIndex = Number(config.leaf_index);
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`Invalid leaf_index ${config.leaf_index}. Must be in [0, ${leaves.length - 1}]`);
  }

  if (leaves[leafIndex] !== BigInt(identity.commitment.toString())) {
    throw new Error("Commitment mismatch at configured leaf_index");
  }

  const group = new Group(leaves);
  const merkleProof = group.generateMerkleProof(leafIndex);
  const merkleProofLength = merkleProof.siblings.length;
  const merkleProofSiblings = [...merkleProof.siblings];
  for (let i = 0; i < TREE_DEPTH; i += 1) {
    if (merkleProofSiblings[i] === undefined) {
      merkleProofSiblings[i] = 0n;
    }
  }

  console.log(`Tree depth: ${TREE_DEPTH}`);
  console.log(`Root: ${merkleProof.root.toString()}`);

  const artifacts = resolveSnarkArtifacts();
  const { proof, publicSignals } = await groth16.fullProve(
    {
      secret: identity.secretScalar,
      merkleProofLength,
      merkleProofIndex: merkleProof.index,
      merkleProofSiblings,
      scope: semaphoreHash(pollId).toString(),
      message: semaphoreHash(option).toString(),
    },
    artifacts.wasm,
    artifacts.zkey
  );
  const packedProof = packGroth16Proof(proof);

  const samplesDir = path.join(__dirname, "../samples");
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  fs.writeFileSync(path.join(samplesDir, "proof.json"), JSON.stringify(packedProof, null, 2));
  fs.writeFileSync(
    path.join(samplesDir, "public.json"),
    JSON.stringify(
      {
        publicSignals: publicSignals.map((s: string | bigint) => s.toString()),
        root: publicSignals[0].toString(),
        depth: TREE_DEPTH,
      },
      null,
      2
    )
  );

  console.log(`Proof generated for depth ${TREE_DEPTH}.`);
  console.log("Output: samples/proof.json, samples/public.json");
  process.exit(0);
}

main().catch(console.error);
