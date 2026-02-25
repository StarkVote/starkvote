#!/usr/bin/env tsx

import { config } from "dotenv";
import { Account, RpcProvider, Signer, json, hash, CallData } from "starknet";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../..");
const contractsDir = join(rootDir, "contracts/target/dev");

config({ path: join(__dirname, "../.env") });

function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function loadContract(name: string) {
  const sierra = json.parse(
    readFileSync(join(contractsDir, `starkvote_${name}.contract_class.json`), "utf-8")
  );
  const casm = json.parse(
    readFileSync(join(contractsDir, `starkvote_${name}.compiled_contract_class.json`), "utf-8")
  );
  const classHash = hash.computeContractClassHash(sierra);
  const compiledClassHash = hash.computeCompiledClassHash(casm);
  return { sierra, casm, classHash, compiledClassHash };
}

async function isClassDeclared(provider: RpcProvider, classHash: string): Promise<boolean> {
  try {
    await provider.getClassByHash(classHash);
    return true;
  } catch {
    return false;
  }
}

async function declareIfNeeded(
  account: Account,
  provider: RpcProvider,
  name: string,
  contract: ReturnType<typeof loadContract>
) {
  const declared = await isClassDeclared(provider, contract.classHash);
  if (declared) {
    console.log(`  Class already declared: ${contract.classHash}`);
    return contract.classHash;
  }

  console.log(`  Declaring class ${contract.classHash}...`);
  const declareResult = await account.declare({
    contract: contract.sierra,
    casm: contract.casm,
  });
  console.log(`  Declare tx: ${declareResult.transaction_hash}`);
  await provider.waitForTransaction(declareResult.transaction_hash);
  console.log(`  Declared!`);
  return declareResult.class_hash;
}

async function deployContract(
  account: Account,
  provider: RpcProvider,
  classHash: string,
  constructorCalldata: any[],
) {
  const deployResult = await account.deployContract({
    classHash,
    constructorCalldata,
  });
  console.log(`  Deploy tx: ${deployResult.transaction_hash}`);
  await provider.waitForTransaction(deployResult.transaction_hash);
  return deployResult.contract_address;
}

async function main() {
  console.log("==========================================");
  console.log("StarkVote Full Deployment");
  console.log("==========================================\n");

  const deployerAddressEnv = process.env.ACCOUNT_ADDRESS;
  const privateKeyEnv = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || "https://starknet-sepolia-rpc.publicnode.com";
  if (!deployerAddressEnv || !privateKeyEnv) {
    throw new Error("Missing ACCOUNT_ADDRESS or PRIVATE_KEY in zk/.env");
  }

  const deployerAddress = normalizeHex(deployerAddressEnv);
  const privateKey = normalizeHex(privateKeyEnv);

  console.log(`Deployer: ${deployerAddress}`);
  console.log(`RPC:   ${rpcUrl}\n`);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account({
    provider,
    address: deployerAddress,
    signer: new Signer(privateKey),
    cairoVersion: "1",
  });

  // Load all contracts
  console.log("Loading contracts...");
  const groth16 = loadContract("Groth16VerifierBN254");
  const verifier = loadContract("Semaphore30Verifier");
  const registry = loadContract("VoterSetRegistry");
  const poll = loadContract("Poll");
  console.log(`  Groth16VerifierBN254: ${groth16.classHash}`);
  console.log(`  Semaphore30Verifier:  ${verifier.classHash}`);
  console.log(`  VoterSetRegistry:     ${registry.classHash}`);
  console.log(`  Poll:                 ${poll.classHash}\n`);

  // 1. Declare + Deploy Groth16VerifierBN254
  console.log("1/4 Groth16VerifierBN254...");
  const groth16ClassHash = await declareIfNeeded(account, provider, "Groth16VerifierBN254", groth16);
  const groth16Address = await deployContract(account, provider, groth16ClassHash, []);
  console.log(`  Address: ${groth16Address}\n`);

  // 2. Declare + Deploy Semaphore30Verifier
  console.log("2/4 Semaphore30Verifier...");
  const verifierClassHash = await declareIfNeeded(account, provider, "Semaphore30Verifier", verifier);
  const verifierAddress = await deployContract(account, provider, verifierClassHash, [groth16Address]);
  console.log(`  Address: ${verifierAddress}\n`);

  // 3. Declare + Deploy VoterSetRegistry
  console.log("3/4 VoterSetRegistry...");
  const registryClassHash = await declareIfNeeded(account, provider, "VoterSetRegistry", registry);
  const registryAddress = await deployContract(account, provider, registryClassHash, []);
  console.log(`  Address: ${registryAddress}\n`);

  // 4. Declare + Deploy Poll
  console.log("4/4 Poll...");
  const pollClassHash = await declareIfNeeded(account, provider, "Poll", poll);
  const pollAddress = await deployContract(account, provider, pollClassHash, [registryAddress, verifierAddress]);
  console.log(`  Address: ${pollAddress}\n`);

  // Save addresses
  const localDir = join(__dirname, "../.local");
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
  }
  const outputPath = join(localDir, "contract_addresses.json");
  const data = {
    network: "sepolia",
    deployed_at: new Date().toISOString(),
    deployer_address: deployerAddress,
    groth16_verifier_address: groth16Address,
    verifier_address: verifierAddress,
    registry_address: registryAddress,
    poll_address: pollAddress,
    transaction_hashes: {},
  };
  writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log("Deployment complete!");
  console.log(`Groth16Verifier: ${groth16Address}`);
  console.log(`Verifier:        ${verifierAddress}`);
  console.log(`Registry:        ${registryAddress}`);
  console.log(`Poll:            ${pollAddress}`);
  console.log(`Saved:           ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
