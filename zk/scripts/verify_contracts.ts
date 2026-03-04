#!/usr/bin/env tsx

/**
 * Verify all StarkVote contracts on Voyager block explorer.
 *
 * Prerequisites:
 *   - snforge / sncast installed (Starknet Foundry)
 *     curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
 *     snfoundryup
 *   - Contracts built: cd contracts && scarb build
 *
 * Usage:
 *   npm run verify
 */

import { json, hash } from "starknet";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../..");
const contractsDir = join(rootDir, "contracts/target/dev");
const scarbWorkspace = join(rootDir, "contracts");

const NETWORK = "sepolia";
const VERIFIER = "voyager";

const contracts = [
  { name: "Groth16VerifierBN254", artifact: "starkvote_Groth16VerifierBN254" },
  { name: "Semaphore30Verifier", artifact: "starkvote_Semaphore30Verifier" },
  { name: "VoterSetRegistry",    artifact: "starkvote_VoterSetRegistry" },
  { name: "Poll",                artifact: "starkvote_Poll" },
];

function checkSncast(): boolean {
  try {
    execSync("sncast --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getClassHash(artifactName: string): string {
  const sierra = json.parse(
    readFileSync(join(contractsDir, `${artifactName}.contract_class.json`), "utf-8")
  );
  return hash.computeContractClassHash(sierra);
}

async function main() {
  if (!checkSncast()) {
    console.error("sncast not found. Install Starknet Foundry:");
    console.error("  curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh");
    console.error("  snfoundryup");
    process.exit(1);
  }

  console.log(`Verifying ${contracts.length} contracts on ${NETWORK} via ${VERIFIER}...\n`);

  const results: { name: string; status: string; classHash: string }[] = [];

  for (const contract of contracts) {
    const classHash = getClassHash(contract.artifact);
    console.log(`[${contract.name}]`);
    console.log(`  Class hash: ${classHash}`);

    try {
      execSync(
        [
          "sncast", "verify",
          "--contract-name", contract.name,
          "--class-hash", classHash,
          "--verifier", VERIFIER,
          "--network", NETWORK,
          "--confirm-verification",
        ].join(" "),
        { stdio: "inherit", cwd: scarbWorkspace }
      );
      console.log(`  ✅ Verified\n`);
      results.push({ name: contract.name, status: "verified", classHash });
    } catch {
      console.error(`  ❌ Failed\n`);
      results.push({ name: contract.name, status: "failed", classHash });
    }
  }

  console.log("\n--- Summary ---");
  for (const r of results) {
    const icon = r.status === "verified" ? "✅" : "❌";
    console.log(`${icon} ${r.name}  ${r.classHash}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.log(`\n${failed.length} contract(s) failed verification.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
