#!/usr/bin/env tsx

import { config } from "dotenv";
import { Account, RpcProvider, json } from "starknet";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../..");
const contractsDir = join(rootDir, "contracts/target/dev");

config({ path: join(__dirname, "../.env") });

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   StarkVote Deployment                   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || "https://rpc.starknet-testnet.lava.build";

  if (!ADMIN_ADDRESS || !PRIVATE_KEY) {
    console.error("Missing ADMIN_ADDRESS or PRIVATE_KEY in .env");
    process.exit(1);
  }

  const account = new Account({
    provider: { nodeUrl: RPC_URL },
    address: ADMIN_ADDRESS,
    signer: PRIVATE_KEY,
    cairoVersion: "1",
  });

  console.log(`Admin:  ${ADMIN_ADDRESS}`);
  console.log(`RPC:    ${RPC_URL}\n`);

  const registrySierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.sierra.json"), "utf-8")
  );
  const registryCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_VoterSetRegistry.casm.json"), "utf-8")
  );
  const verifierSierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_MockVerifier.sierra.json"), "utf-8")
  );
  const verifierCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_MockVerifier.casm.json"), "utf-8")
  );
  const pollSierra = json.parse(
    readFileSync(join(contractsDir, "starkvote_Poll.sierra.json"), "utf-8")
  );
  const pollCasm = json.parse(
    readFileSync(join(contractsDir, "starkvote_Poll.casm.json"), "utf-8")
  );

  console.log("Deploying VoterSetRegistry...");
  const registry = await account.declareAndDeploy({
    contract: registrySierra,
    casm: registryCasm,
    constructorCalldata: [ADMIN_ADDRESS],
  });
  console.log(` ${registry.deploy.address}\n`);

  console.log("Deploying MockVerifier...");
  const verifier = await account.declareAndDeploy({
    contract: verifierSierra,
    casm: verifierCasm,
    constructorCalldata: [],
  });
  console.log(` ${verifier.deploy.address}\n`);

  console.log("Deploying Poll...");
  const poll = await account.declareAndDeploy({
    contract: pollSierra,
    casm: pollCasm,
    constructorCalldata: [ADMIN_ADDRESS, registry.deploy.address, verifier.deploy.address],
  });
  console.log(` ${poll.deploy.address}\n`);

  const envPath = join(__dirname, "../.env");
  const currentEnv = readFileSync(envPath, "utf-8");
  const envLines = currentEnv.split("\n").filter(
    line => !line.startsWith("REGISTRY_ADDRESS=") &&
            !line.startsWith("VERIFIER_ADDRESS=") &&
            !line.startsWith("POLL_ADDRESS=") &&
            !line.includes("# Deployed Contracts")
  );

  const newEnv = envLines.join("\n") + `
# Deployed Contracts (${new Date().toISOString()})
REGISTRY_ADDRESS=${registry.deploy.address}
VERIFIER_ADDRESS=${verifier.deploy.address}
POLL_ADDRESS=${poll.deploy.address}
`;

  writeFileSync(envPath, newEnv);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract Addresses:");
  console.log(`Registry: ${registry.deploy.address}`);
  console.log(`Verifier: ${verifier.deploy.address}`);
  console.log(`Poll:     ${poll.deploy.address}\n`);

  console.log("Deployment complete!");
}

main().catch((error) => {
  console.error("\nDeployment failed:", error.message);
  process.exit(1);
});
