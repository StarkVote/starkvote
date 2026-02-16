#!/usr/bin/env tsx

import { config } from "dotenv";
import { Account, RpcProvider, Signer, json } from "starknet";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../..");
const contractsDir = join(rootDir, "contracts/target/dev");

const WORLDCOIN_VERIFIER = "0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a";

config({ path: join(__dirname, "../.env") });

function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

async function main() {
  if (process.argv.includes("--mock-verifier")) {
    console.error("Mock verifier mode is not supported in this flow.");
    console.error("Use Worldcoin verifier mode (default).");
    process.exit(1);
  }

  console.log("==========================================");
  console.log("StarkVote Deployment (Worldcoin Verifier)");
  console.log("==========================================\n");

  const adminAddressEnv = process.env.ADMIN_ADDRESS;
  const privateKeyEnv = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || "https://rpc.starknet-testnet.lava.build";
  if (!adminAddressEnv || !privateKeyEnv) {
    throw new Error("Missing ADMIN_ADDRESS or PRIVATE_KEY in zk/.env");
  }

  const adminAddress = normalizeHex(adminAddressEnv);
  const privateKey = normalizeHex(privateKeyEnv);

  console.log(`Admin:    ${adminAddress}`);
  console.log(`RPC:      ${rpcUrl}`);
  console.log(`Verifier: ${WORLDCOIN_VERIFIER}\n`);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account({
    provider,
    address: adminAddress,
    signer: new Signer(privateKey),
    cairoVersion: "1",
  });

  const registrySierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.sierra.json"), "utf-8")
  );
  const registryCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.casm.json"), "utf-8")
  );
  const pollSierra = json.parse(readFileSync(join(contractsDir, "starkvote_Poll.sierra.json"), "utf-8"));
  const pollCasm = json.parse(readFileSync(join(contractsDir, "starkvote_Poll.casm.json"), "utf-8"));

  console.log("Deploying VoterSetRegistry...");
  const registryDeploy = await account.declareAndDeploy({
    contract: registrySierra,
    casm: registryCasm,
    constructorCalldata: [adminAddress],
  });
  await provider.waitForTransaction(registryDeploy.deploy.transaction_hash);
  console.log(`  OK ${registryDeploy.deploy.contract_address}\n`);

  console.log("Deploying Poll...");
  const pollDeploy = await account.declareAndDeploy({
    contract: pollSierra,
    casm: pollCasm,
    constructorCalldata: [adminAddress, registryDeploy.deploy.contract_address, WORLDCOIN_VERIFIER],
  });
  await provider.waitForTransaction(pollDeploy.deploy.transaction_hash);
  console.log(`  OK ${pollDeploy.deploy.contract_address}\n`);

  const localDir = join(__dirname, "../.local");
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
  }
  const outputPath = join(localDir, "contract_addresses.json");
  const data = {
    network: "sepolia",
    deployed_at: new Date().toISOString(),
    admin_address: adminAddress,
    registry_address: registryDeploy.deploy.contract_address,
    verifier_address: WORLDCOIN_VERIFIER,
    verifier_type: "WorldCoin",
    poll_address: pollDeploy.deploy.contract_address,
    transaction_hashes: {
      registry: registryDeploy.deploy.transaction_hash,
      verifier: "N/A (predeployed Worldcoin verifier)",
      poll: pollDeploy.deploy.transaction_hash,
    },
  };
  writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log("Deployment complete.");
  console.log(`Registry: ${registryDeploy.deploy.contract_address}`);
  console.log(`Verifier: ${WORLDCOIN_VERIFIER}`);
  console.log(`Poll:     ${pollDeploy.deploy.contract_address}`);
  console.log(`Saved:    ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
