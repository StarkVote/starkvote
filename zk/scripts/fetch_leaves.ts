/**
 * Fetch Leaves from Registry
 *
 * Reads all voter commitments from deployed VoterSetRegistry contract.
 * These are needed to build the Merkle tree off-chain for proof generation.
 *
 * Prerequisites: .local/contract_addresses.json with registry_address
 * Output: .local/leaves.json (all commitments)
 * Usage: npm run fetch-leaves
 */
import { RpcProvider, Contract } from "starknet";
import * as fs from "fs";
import * as path from "path";

// Load contract ABI (simplified - just the functions we need)
const REGISTRY_ABI = [
    {
        "type": "function",
        "name": "get_leaf_count",
        "inputs": [],
        "outputs": [{ "type": "core::integer::u32" }],
        "state_mutability": "view"
    },
    {
        "type": "function",
        "name": "get_leaf",
        "inputs": [{ "name": "index", "type": "core::integer::u32" }],
        "outputs": [{ "type": "core::felt252" }],
        "state_mutability": "view"
    },
    {
        "type": "function",
        "name": "is_frozen",
        "inputs": [],
        "outputs": [{ "type": "core::bool" }],
        "state_mutability": "view"
    }
];

async function main() {
    // Load config
    const configPath = path.join(__dirname, '../.local/contract_addresses.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ Error: .local/contract_addresses.json not found');
        console.log('Please create it with:');
        console.log(JSON.stringify({ registry_address: "0x..." }, null, 2));
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const registryAddress = config.registry_address;

    // Connect to Starknet Sepolia
    const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.public.blastapi.io" });
    const registry = new Contract(REGISTRY_ABI, registryAddress, provider);

    console.log(`📡 Fetching leaves from registry: ${registryAddress}`);

    // Check if frozen
    const isFrozen = await registry.is_frozen();
    console.log(`Frozen: ${isFrozen}`);

    // Get leaf count
    const leafCount = await registry.get_leaf_count();
    console.log(`Leaf count: ${leafCount}`);

    if (leafCount === 0n) {
        console.log('⚠️  No leaves in registry yet');
        return;
    }

    // Fetch all leaves
    const leaves: string[] = [];
    for (let i = 0; i < Number(leafCount); i++) {
        const leaf = await registry.get_leaf(i);
        leaves.push(leaf.toString());
        console.log(`Leaf ${i}: ${leaf}`);
    }

    // Save to .local/leaves.json
    const localDir = path.join(__dirname, '../.local');
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(localDir, 'leaves.json'),
        JSON.stringify({ leaves, count: leaves.length }, null, 2)
    );

    console.log(`✅ Saved ${leaves.length} leaves to .local/leaves.json`);
}

main().catch(console.error);
