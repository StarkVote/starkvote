/**
 * Generate Garaga-compatible full_proof_with_hints from Semaphore proof outputs.
 * TypeScript replacement for gen_worldcoin_calldata.py — no Python required.
 *
 * Uses the `garaga` npm package (Rust compiled to WASM) for calldata generation.
 *
 * Inputs:
 *   - zk/samples/proof.json          (Semaphore packed proof: 8 elements)
 *   - zk/samples/public.json         (publicSignals array)
 *   - zk/artifacts/verification_key30.json
 *   - zk/.local/proof_config.json    (poll_id, option)
 *
 * Output:
 *   - zk/samples/worldcoin_calldata.json
 */
import { init, getGroth16CallData, CurveId } from "garaga";
import type { Groth16Proof, Groth16VerifyingKey } from "garaga";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const zkDir = path.join(__dirname, "..");

/**
 * Convert Semaphore v4 packed proof (8 elements) to Garaga Groth16Proof.
 *
 * Packed format: [a0, a1, b01, b00, b11, b10, c0, c1]
 * Note: b-coordinates are in swapped order in the packed format.
 */
function parsePackedProof(
  proofData: (string | bigint)[],
  publicSignals: string[]
): Groth16Proof {
  if (proofData.length !== 8) {
    throw new Error(`Packed proof must have 8 elements, got ${proofData.length}`);
  }

  const [a0, a1, b01, b00, b11, b10, c0, c1] = proofData.map(BigInt);

  return {
    a: { x: a0, y: a1, curveId: CurveId.BN254 },
    b: { x: [b00, b01], y: [b10, b11], curveId: CurveId.BN254 },
    c: { x: c0, y: c1, curveId: CurveId.BN254 },
    publicInputs: publicSignals.map(BigInt),
  };
}

/**
 * Parse snarkjs verification key JSON into Garaga Groth16VerifyingKey.
 */
function parseVerifyingKey(vkData: any): Groth16VerifyingKey {
  const toG1 = (p: string[]): { x: bigint; y: bigint; curveId: CurveId } => ({
    x: BigInt(p[0]),
    y: BigInt(p[1]),
    curveId: CurveId.BN254,
  });

  const toG2 = (
    p: string[][]
  ): { x: [bigint, bigint]; y: [bigint, bigint]; curveId: CurveId } => ({
    x: [BigInt(p[0][0]), BigInt(p[0][1])],
    y: [BigInt(p[1][0]), BigInt(p[1][1])],
    curveId: CurveId.BN254,
  });

  return {
    alpha: toG1(vkData.vk_alpha_1),
    beta: toG2(vkData.vk_beta_2),
    gamma: toG2(vkData.vk_gamma_2),
    delta: toG2(vkData.vk_delta_2),
    ic: vkData.IC.map(toG1),
  };
}

async function main(): Promise<number> {
  const proofPath = path.join(zkDir, "samples", "proof.json");
  const publicPath = path.join(zkDir, "samples", "public.json");
  const configPath = path.join(zkDir, ".local", "proof_config.json");
  const vkPath = path.join(zkDir, "artifacts", "verification_key30.json");
  const outPath = path.join(zkDir, "samples", "worldcoin_calldata.json");

  const required = [proofPath, publicPath, configPath, vkPath];
  const missing = required.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    console.error("Missing required files:");
    missing.forEach((f) => console.error(`  - ${f}`));
    return 1;
  }

  // Initialize Garaga WASM
  await init();

  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
  const publicData = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const vkData = JSON.parse(fs.readFileSync(vkPath, "utf-8"));

  const publicSignals: string[] = publicData.publicSignals;
  if (!Array.isArray(publicSignals) || publicSignals.length < 4) {
    console.error("public.json must contain publicSignals array with at least 4 entries");
    return 1;
  }

  // Parse proof and VK
  const proof = parsePackedProof(proofData, publicSignals);
  const vk = parseVerifyingKey(vkData);

  // Generate calldata via Garaga WASM
  const calldata = getGroth16CallData(proof, vk, CurveId.BN254);

  // Strip Garaga's length prefix — starknet.js adds its own Span length
  const calldataNoPrefix = calldata.slice(1);

  // Write output
  const samplesDir = path.dirname(outPath);
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  const output = {
    poll_id: Number(config.poll_id),
    option: Number(config.option),
    full_proof_with_hints_len: calldataNoPrefix.length,
    full_proof_with_hints: calldataNoPrefix.map((x: bigint) => "0x" + x.toString(16)),
    public_signals: publicSignals.map(String),
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Generated ${outPath}`);
  console.log(`Calldata length: ${calldata.length} felts`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
