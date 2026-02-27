import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { packGroth16Proof } from "@semaphore-protocol/proof";
import { CurveId, getGroth16CallData, init as initGaraga } from "garaga";
import { keccak256, toBeHex, zeroPadValue } from "ethers";

import {
  DEFAULT_POLL_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
  DEFAULT_RPC_URL,
  createPollContract,
  createProvider,
  createRegistryContract,
  toAddress,
  toBigIntValue,
  toBoolean,
} from "@/lib/starkvote";

const TREE_DEPTH = 30;
const MAX_UI_LEAF_COUNT = 10_000;
const LEAF_FETCH_BATCH_SIZE = 24;

type GaragaG1 = { x: bigint; y: bigint; curveId: CurveId };
type GaragaG2 = {
  x: [bigint, bigint];
  y: [bigint, bigint];
  curveId: CurveId;
};

type GaragaProof = {
  a: GaragaG1;
  b: GaragaG2;
  c: GaragaG1;
  publicInputs: bigint[];
};

type GaragaVerifyingKey = {
  alpha: GaragaG1;
  beta: GaragaG2;
  gamma: GaragaG2;
  delta: GaragaG2;
  ic: GaragaG1[];
};

type RawVerificationKey = {
  vk_alpha_1: [string, string];
  vk_beta_2: [[string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string]];
  IC: [string, string][];
};

type SnarkGroth16 = {
  fullProve: (
    input: Record<string, unknown>,
    wasmFile: string,
    zkeyFileName: string,
  ) => Promise<{ proof: unknown; publicSignals: Array<string | bigint> }>;
};

type SnarkJsModule = { groth16: SnarkGroth16 };

type GenerateProofParams = {
  pollId: bigint;
  option: number;
  identitySerialized: string;
  rpcUrl?: string;
  pollAddress?: string;
  registryAddressFallback?: string;
};

export type GenerateProofResult = {
  poll_id: string;
  option: number;
  leaf_index: number;
  leaf_count: number;
  full_proof_with_hints: string[];
  public_signals: string[];
};

let garagaInitPromise: Promise<unknown> | null = null;

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function readField(raw: unknown, key: string, index: number): unknown {
  if (typeof raw === "object" && raw !== null && key in raw) {
    return (raw as Record<string, unknown>)[key];
  }
  if (Array.isArray(raw) && index < raw.length) {
    return raw[index];
  }
  return undefined;
}

function toSafeNumber(value: unknown, label: string): number {
  const bigintValue = toBigIntValue(value);
  if (bigintValue < 0n || bigintValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is out of range.`);
  }
  return Number(bigintValue);
}

function semaphoreHash(value: bigint): bigint {
  const padded = zeroPadValue(toBeHex(value), 32);
  return BigInt(keccak256(padded)) >> 8n;
}

function parsePackedProof(
  packedProof: Array<string | bigint>,
  publicSignals: string[],
): GaragaProof {
  if (packedProof.length !== 8) {
    throw new Error(`Packed proof must contain 8 elements, got ${packedProof.length}.`);
  }

  const [a0, a1, b01, b00, b11, b10, c0, c1] = packedProof.map(BigInt);

  return {
    a: { x: a0, y: a1, curveId: CurveId.BN254 },
    b: { x: [b00, b01], y: [b10, b11], curveId: CurveId.BN254 },
    c: { x: c0, y: c1, curveId: CurveId.BN254 },
    publicInputs: publicSignals.map(BigInt),
  };
}

function parseVerifyingKey(vkData: RawVerificationKey): GaragaVerifyingKey {
  const toG1 = (point: [string, string]): GaragaG1 => ({
    x: BigInt(point[0]),
    y: BigInt(point[1]),
    curveId: CurveId.BN254,
  });

  const toG2 = (point: [[string, string], [string, string]]): GaragaG2 => ({
    x: [BigInt(point[0][0]), BigInt(point[0][1])],
    y: [BigInt(point[1][0]), BigInt(point[1][1])],
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

function resolveArtifactsDir(): string {
  const configured = process.env.SEMAPHORE_ARTIFACTS_DIR?.trim();
  if (!configured) {
    // Try local monorepo path first, fall back to public/artifacts for Vercel
    const monorepo = path.resolve(process.cwd(), "../zk/artifacts");
    if (fs.existsSync(monorepo)) return monorepo;
    return path.resolve(process.cwd(), "public/artifacts");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function resolveArtifacts() {
  const artifactsDir = resolveArtifactsDir();
  const wasmPath = path.join(artifactsDir, "semaphore30.wasm");
  const zkeyPath = path.join(artifactsDir, "semaphore30.zkey");
  const vkPath = path.join(artifactsDir, "verification_key30.json");

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkPath)) {
    throw new Error(
      [
        "Missing Semaphore artifacts.",
        `Expected in: ${artifactsDir}`,
        "Required files:",
        "  - semaphore30.wasm",
        "  - semaphore30.zkey",
        "  - verification_key30.json",
      ].join("\n"),
    );
  }

  return { wasmPath, zkeyPath, vkPath };
}

async function ensureGaragaInitialized() {
  if (!garagaInitPromise) {
    garagaInitPromise = initGaraga();
  }
  await garagaInitPromise;
}

async function loadSnarkJs(): Promise<SnarkJsModule> {
  return (await import("snarkjs")) as unknown as SnarkJsModule;
}

async function fetchLeaves(
  registryRead: ReturnType<typeof createRegistryContract>,
  pollIdForCall: string,
  leafCount: number,
): Promise<bigint[]> {
  const leaves = new Array<bigint>(leafCount);

  for (let start = 0; start < leafCount; start += LEAF_FETCH_BATCH_SIZE) {
    const batchSize = Math.min(LEAF_FETCH_BATCH_SIZE, leafCount - start);
    const requests = Array.from({ length: batchSize }, (_, offset) =>
      registryRead.get_leaf(pollIdForCall, start + offset),
    );
    const rawLeaves = await Promise.all(requests);
    rawLeaves.forEach((rawLeaf, offset) => {
      leaves[start + offset] = toBigIntValue(rawLeaf);
    });
  }

  return leaves;
}

export async function generateProofCalldataForPoll({
  pollId,
  option,
  identitySerialized,
  rpcUrl = DEFAULT_RPC_URL,
  pollAddress = DEFAULT_POLL_ADDRESS,
  registryAddressFallback = DEFAULT_REGISTRY_ADDRESS,
}: GenerateProofParams): Promise<GenerateProofResult> {
  const provider = createProvider(rpcUrl);
  const pollIdForCall = pollId.toString();

  const pollRead = createPollContract(pollAddress, provider);
  const rawPoll = await pollRead.get_poll(pollIdForCall);

  const pollExists = toBoolean(readField(rawPoll, "exists", 0));
  if (!pollExists) {
    throw new Error(`Poll ${pollIdForCall} does not exist.`);
  }

  const optionsCount = toSafeNumber(readField(rawPoll, "options_count", 1) ?? 0, "Options");
  if (option < 0 || option >= optionsCount) {
    throw new Error(
      `Option out of range for poll ${pollIdForCall}. Allowed options are 0-${
        Math.max(optionsCount - 1, 0)
      }.`,
    );
  }

  const snapshotRoot = toBigIntValue(readField(rawPoll, "snapshot_root", 4) ?? 0);

  let registryAddress = registryAddressFallback;
  try {
    const linkedRegistry = await pollRead.get_registry();
    registryAddress = toAddress(linkedRegistry);
  } catch {
    registryAddress = registryAddressFallback;
  }

  const registryRead = createRegistryContract(registryAddress, provider);
  const frozen = await registryRead.is_frozen(pollIdForCall);
  if (!toBoolean(frozen)) {
    throw new Error("Voter set is not frozen yet. Ask the poll admin to freeze first.");
  }

  const leafCountRaw = await registryRead.get_leaf_count(pollIdForCall);
  const leafCount = toSafeNumber(leafCountRaw, "Leaf count");
  if (leafCount <= 0) {
    throw new Error("No commitments are registered for this poll.");
  }
  if (leafCount > MAX_UI_LEAF_COUNT) {
    throw new Error(
      `This poll has ${leafCount} commitments. UI proof generation currently supports up to ${MAX_UI_LEAF_COUNT}.`,
    );
  }

  const identity = Identity.import(identitySerialized);
  const commitment = BigInt(identity.commitment.toString());

  const leaves = await fetchLeaves(registryRead, pollIdForCall, leafCount);
  const leafIndex = leaves.findIndex((leaf) => leaf === commitment);
  if (leafIndex < 0) {
    throw new Error(
      "Commitment from identity.json was not found in this poll. Register it before generating proof.",
    );
  }

  const group = new Group(leaves);
  const merkleProof = group.generateMerkleProof(leafIndex);
  const merkleProofLength = merkleProof.siblings.length;
  if (merkleProofLength > TREE_DEPTH) {
    throw new Error(`Merkle proof depth ${merkleProofLength} exceeds supported depth ${TREE_DEPTH}.`);
  }

  const merkleProofSiblings = [...merkleProof.siblings];
  for (let i = merkleProofSiblings.length; i < TREE_DEPTH; i += 1) {
    merkleProofSiblings[i] = 0n;
  }

  const { wasmPath, zkeyPath, vkPath } = resolveArtifacts();
  const snarkjs = await loadSnarkJs();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      secret: identity.secretScalar,
      merkleProofLength,
      merkleProofIndex: merkleProof.index,
      merkleProofSiblings,
      scope: semaphoreHash(pollId).toString(),
      message: semaphoreHash(BigInt(option)).toString(),
    },
    wasmPath,
    zkeyPath,
  );

  const packedProof = packGroth16Proof(proof as never);
  const publicSignalsStrings = publicSignals.map((signal) => signal.toString());

  if (publicSignalsStrings.length < 1) {
    throw new Error("Proof generation returned empty public signals.");
  }

  const generatedRoot = BigInt(publicSignalsStrings[0]);
  if (generatedRoot !== snapshotRoot) {
    throw new Error(
      "Generated proof root does not match poll snapshot root. Ensure you generated proof for the same frozen registry snapshot.",
    );
  }

  const vkData = JSON.parse(fs.readFileSync(vkPath, "utf-8")) as RawVerificationKey;
  const garagaProof = parsePackedProof(packedProof, publicSignalsStrings);
  const garagaVk = parseVerifyingKey(vkData);

  await ensureGaragaInitialized();
  const calldata = getGroth16CallData(garagaProof, garagaVk, CurveId.BN254);
  const calldataWithoutPrefix = calldata.slice(1);

  return {
    poll_id: pollIdForCall,
    option,
    leaf_index: leafIndex,
    leaf_count: leafCount,
    full_proof_with_hints: calldataWithoutPrefix.map((value) => toHex(BigInt(value))),
    public_signals: publicSignalsStrings,
  };
}
