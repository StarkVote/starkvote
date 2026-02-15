/**
 * Generate Identity Commitment
 *
 * Creates a new Semaphore identity with:
 * - trapdoor (secret)
 * - nullifier (secret)
 * - commitment (public - share this with admin)
 *
 * Output: .local/identity.json (KEEP THIS SECRET!)
 * Usage: npm run gen-identity
 */
import { Identity } from "@semaphore-protocol/identity";
import * as fs from "fs";
import * as path from "path";

async function main() {
    // Generate new identity
    const identity = new Identity();

    // Export identity data
    const identityData = {
        serialized: identity.toString(),
        trapdoor: identity.trapdoor.toString(),
        nullifier: identity.nullifier.toString(),
        commitment: identity.commitment.toString()
    };

    // Ensure .local directory exists
    const localDir = path.join(__dirname, '../.local');
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    // Save to .local/identity.json (SECRET - never commit!)
    fs.writeFileSync(
        path.join(localDir, 'identity.json'),
        JSON.stringify(identityData, null, 2)
    );

    console.log('✅ Identity generated!');
    console.log(`Commitment: ${identity.commitment}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Keep .local/identity.json SECRET!');
    console.log('📋 Share only the commitment with the admin to register as a voter.');
}

main().catch(console.error);
