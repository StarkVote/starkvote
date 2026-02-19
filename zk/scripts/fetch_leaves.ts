import { Contract, RpcProvider } from "starknet";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../..");
const contractsDir = path.join(rootDir, "contracts/target/dev");
config({ path: path.join(__dirname, "../.env") });

const REGISTRY_ABI = JSON.parse(
  fs.readFileSync(path.join(contractsDir, "starkvote_VoterSetRegistry.contract_class.json"), "utf-8")
).abi;

function u256ToBigInt(value: any): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && value.low !== undefined && value.high !== undefined) {
    return (BigInt(value.high) << 128n) + BigInt(value.low);
  }
  throw new Error(`Unsupported u256 value: ${JSON.stringify(value)}`);
}

async function main() {
  const pollId = Number(process.argv[2]);
  if (!pollId && pollId !== 0) {
    console.error("Usage: npm run fetch-leaves -- <pollId>");
    process.exit(1);
  }

  const configPath = path.join(__dirname, "../.local/contract_addresses.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("Missing .local/contract_addresses.json. Run npm run deploy first.");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const registryAddress = config.registry_address;
  if (!registryAddress) {
    throw new Error("registry_address missing in .local/contract_addresses.json");
  }

  const provider = new RpcProvider({
    nodeUrl: process.env.RPC_URL || "https://rpc.starknet-testnet.lava.build",
  });

  const registry = new Contract({
    abi: REGISTRY_ABI,
    address: registryAddress,
    providerOrAccount: provider,
  });

  console.log(`Fetching leaves for poll ${pollId} from ${registryAddress}`);

  const isFrozen = await registry.is_frozen(pollId);
  const leafCountRaw = await registry.get_leaf_count(pollId);
  const leafCount = Number(leafCountRaw.toString());
  console.log(`is_frozen: ${isFrozen}`);
  console.log(`leaf_count: ${leafCount}`);

  const leaves: string[] = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = await registry.get_leaf(pollId, i);
    leaves.push(u256ToBigInt(leaf).toString());
  }

  const outputDir = path.join(__dirname, "../.local");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "leaves.json");

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        registry_address: registryAddress,
        poll_id: pollId,
        is_frozen: Boolean(isFrozen),
        leaf_count: leaves.length,
        leaves,
      },
      null,
      2
    )
  );

  console.log(`Saved ${leaves.length} leaves to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
