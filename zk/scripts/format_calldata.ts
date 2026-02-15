/**
 * Format Calldata for Starknet
 *
 * Converts the ZK proof and public signals into format needed for
 * calling Poll.vote() on Starknet.
 *
 * Prerequisites:
 * - samples/proof.json (from gen-proof)
 * - samples/public.json (from gen-proof)
 * - .local/proof_config.json (poll_id, option)
 *
 * Output: samples/calldata.json (ready for vote submission)
 * Usage: npm run format-calldata
 */
import * as fs from "fs";
import * as path from "path";

function toHex(value: bigint | string): string {
    const bigIntValue = typeof value === 'string' ? BigInt(value) : value;
    return '0x' + bigIntValue.toString(16);
}

async function main() {
    // Load proof
    const proof = JSON.parse(
        fs.readFileSync('samples/proof.json', 'utf-8')
    );

    // Load public signals
    const publicData = JSON.parse(
        fs.readFileSync('samples/public.json', 'utf-8')
    );

    // Load config
    const config = JSON.parse(
        fs.readFileSync('.local/proof_config.json', 'utf-8')
    );

    // Extract Groth16 proof components
    // Semaphore generates standard format: pi_a, pi_b, pi_c
    const proofComponents = {
        // G1 point (affine coordinates, ignore z=1)
        p_a: {
            x: toHex(proof.pi_a[0]),
            y: toHex(proof.pi_a[1])
        },
        // G2 point (Fq2 elements, ignore z)
        p_b: {
            x: [toHex(proof.pi_b[0][0]), toHex(proof.pi_b[0][1])],
            y: [toHex(proof.pi_b[1][0]), toHex(proof.pi_b[1][1])]
        },
        // G1 point
        p_c: {
            x: toHex(proof.pi_c[0]),
            y: toHex(proof.pi_c[1])
        }
    };

    // Public signals: [root, nullifier_hash, signal, scope]
    const publicSignals = publicData.publicSignals.map((s: string) => toHex(s));

    // Format for Poll.vote() call
    const calldata = {
        poll_id: config.poll_id,
        option: config.option,
        root: publicSignals[0],
        nullifier_hash: publicSignals[1],
        signal: publicSignals[2],
        proof_components: proofComponents,
        public_inputs: publicSignals,
        // Flattened proof array for MockVerifier compatibility
        proof_flat: [
            proofComponents.p_a.x,
            proofComponents.p_a.y,
            proofComponents.p_b.x[0],
            proofComponents.p_b.x[1],
            proofComponents.p_b.y[0],
            proofComponents.p_b.y[1],
            proofComponents.p_c.x,
            proofComponents.p_c.y
        ]
    };

    // Save calldata
    fs.writeFileSync(
        'samples/calldata.json',
        JSON.stringify(calldata, null, 2)
    );

    console.log('✅ Calldata formatted for Starknet');
    console.log(`📁 Output: samples/calldata.json`);
    console.log('');
    console.log('Public Signals:');
    console.log(`  Root: ${publicSignals[0]}`);
    console.log(`  Nullifier: ${publicSignals[1]}`);
    console.log(`  Signal: ${publicSignals[2]}`);
    console.log(`  Scope: ${publicSignals[3]}`);
}

main().catch(console.error);
