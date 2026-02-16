/**
 * Generate a Semaphore identity and persist it to .local/identity.json.
 *
 * Output:
 * - .local/identity.json (secret, do not share)
 *
 * Public value to share with admin:
 * - commitment
 */
import { Identity } from "@semaphore-protocol/identity";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const identity = new Identity();

  const identityData = {
    serialized: identity.export(),
    secret_scalar: identity.secretScalar.toString(),
    commitment: identity.commitment.toString(),
  };

  const localDir = path.join(__dirname, "../.local");
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(localDir, "identity.json"),
    JSON.stringify(identityData, null, 2)
  );

  console.log("Identity generated.");
  console.log(`Commitment: ${identity.commitment}`);
  console.log("");
  console.log("IMPORTANT: Keep .local/identity.json secret.");
  console.log("Share only the commitment with the admin.");
}

main().catch(console.error);
