#!/usr/bin/env tsx

import { config } from "dotenv";
import { Account, RpcProvider, json } from "starknet";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../..");
const contractsDir = join(rootDir, "contracts/target/dev");

// WorldCoin's verifier on Sepolia
const WORLDCOIN_VERIFIER = "0x01167d6979330fcc6633111d72416322eb0e3b78ad147a9338abea3c04edfc8a";

config({ path: join(__dirname, "../.env") });

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   StarkVote Deployment                   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Check for verifier mode
  const useMockVerifier = process.argv.includes("--mock-verifier");

  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || "https://starknet-sepolia.public.blastapi.io";

  if (!ADMIN_ADDRESS || !PRIVATE_KEY) {
    console.error("❌ Missing ADMIN_ADDRESS or PRIVATE_KEY in .env");
    console.log("\nCreate zk/.env with:");
    console.log("ADMIN_ADDRESS=0x...");
    console.log("PRIVATE_KEY=0x...");
    process.exit(1);
  }

  // Ensure addresses have 0x prefix
  const adminAddr = ADMIN_ADDRESS.startsWith('0x') ? ADMIN_ADDRESS : `0x${ADMIN_ADDRESS}`;
  const privateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

  console.log(`📋 Configuration:`);
  console.log(`   Admin:    ${adminAddr}`);
  console.log(`   Network:  Sepolia (${RPC_URL})`);
  console.log(`   Verifier: ${useMockVerifier ? 'MockVerifier (testing)' : 'WorldCoin (production)'}\n`);

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider: provider,
    address: adminAddr,
    signer: privateKey
  });

  // Load contract artifacts
  console.log("📦 Loading contract artifacts...\n");

  const registrySierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.sierra.json"), "utf-8")
  );
  const registryCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.casm.json"), "utf-8")
  );

  let verifierSierra, verifierCasm, verifierAddress, verifierDeploy;

  if (useMockVerifier) {
    verifierSierra = json.parse(
      readFileSync(join(contractsDir, "starkvote_MockVerifier.sierra.json"), "utf-8")
    );
    verifierCasm = json.parse(
      readFileSync(join(contractsDir, "starkvote_MockVerifier.casm.json"), "utf-8")
    );
  }

  const pollSierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_Poll.sierra.json"), "utf-8")
  );
  const pollCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_Poll.casm.json"), "utf-8")
  );

  // Deploy VoterSetRegistry
  console.log("🚀 Deploying VoterSetRegistry...");
  const registryDeploy = await account.declareAndDeploy({
    contract: registrySierra,
    casm: registryCasm,
    constructorCalldata: [adminAddr],
  });

  await provider.waitForTransaction(registryDeploy.deploy.transaction_hash);
  console.log(`   ✅ Deployed at: ${registryDeploy.deploy.contract_address}\n`);

  // Deploy or use verifier
  if (useMockVerifier) {
    console.log("🚀 Deploying MockVerifier (for testing only)...");
    verifierDeploy = await account.declareAndDeploy({
      contract: verifierSierra,
      casm: verifierCasm,
      constructorCalldata: [],
    });

    await provider.waitForTransaction(verifierDeploy.deploy.transaction_hash);
    verifierAddress = verifierDeploy.deploy.contract_address;
    console.log(`   ✅ Deployed at: ${verifierAddress}\n`);
  } else {
    verifierAddress = WORLDCOIN_VERIFIER;
    console.log(`✅ Using WorldCoin's verifier: ${verifierAddress}\n`);
  }

  // Deploy Poll
  console.log("🚀 Deploying Poll...");
  const pollDeploy = await account.declareAndDeploy({
    contract: pollSierra,
    casm: pollCasm,
    constructorCalldata: [
      adminAddr,
      registryDeploy.deploy.contract_address,
      verifierAddress
    ],
  });

  await provider.waitForTransaction(pollDeploy.deploy.transaction_hash);
  console.log(`   ✅ Deployed at: ${pollDeploy.deploy.contract_address}\n`);

  // Save addresses to .local/contract_addresses.json
  const localDir = join(__dirname, "../.local");
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
  }

  const addresses = {
    network: "sepolia",
    deployed_at: new Date().toISOString(),
    admin_address: adminAddr,
    registry_address: registryDeploy.deploy.contract_address,
    verifier_address: verifierAddress,
    verifier_type: useMockVerifier ? "MockVerifier" : "WorldCoin",
    poll_address: pollDeploy.deploy.contract_address,
    transaction_hashes: {
      registry: registryDeploy.deploy.transaction_hash,
      verifier: useMockVerifier ? (verifierDeploy as any).deploy.transaction_hash : "N/A (using WorldCoin)",
      poll: pollDeploy.deploy.transaction_hash,
    }
  };

  writeFileSync(
    join(localDir, "contract_addresses.json"),
    JSON.stringify(addresses, null, 2)
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Deployment Complete!\n");
  console.log("📋 Contract Addresses:");
  console.log(`   Registry: ${registryDeploy.deploy.contract_address}`);
  console.log(`   Verifier: ${verifierAddress} ${useMockVerifier ? '(Mock)' : '(WorldCoin)'}`);
  console.log(`   Poll:     ${pollDeploy.deploy.contract_address}`);
  console.log("\n💾 Saved to: .local/contract_addresses.json");
  console.log("\n🎯 Next Steps:");
  console.log("   1. npm run gen-identity (generate voter identities)");
  console.log("   2. Add voters to registry");
  console.log("   3. Freeze registry");
  console.log("   4. Create poll");
  console.log("   5. Start voting!\n");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:", error.message);
  if (error.message.includes("Account balance")) {
    console.error("\n💡 Get Sepolia ETH from: https://starknet-faucet.vercel.app/");
  }
  process.exit(1);
});
