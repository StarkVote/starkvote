#!/usr/bin/env tsx

import { Account, Contract, RpcProvider, Signer, json } from "starknet";
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const zkDir = join(__dirname, "..");
const rootDir = join(__dirname, "../..");
const artifactsDir = join(rootDir, "contracts/target/dev");
const localAddressPath = join(zkDir, ".local/contract_addresses.json");

config({ path: join(zkDir, ".env") });

type CairoU256 = { low: string; high: string };

function loadAbi(sierraFilename: string) {
  const artifact = json.parse(
    readFileSync(join(artifactsDir, sierraFilename), "utf-8")
  );
  return artifact.abi;
}

function loadDeployedAddresses() {
  if (!existsSync(localAddressPath)) {
    return {};
  }
  return JSON.parse(readFileSync(localAddressPath, "utf-8"));
}

function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function parseBigNumberish(value: string): bigint {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty numeric value");
  }
  return BigInt(trimmed);
}

function toU256(value: string | bigint): CairoU256 {
  const n = typeof value === "bigint" ? value : parseBigNumberish(value);
  if (n < 0n) {
    throw new Error(`u256 cannot be negative: ${value.toString()}`);
  }
  const mask = (1n << 128n) - 1n;
  const low = n & mask;
  const high = n >> 128n;
  return {
    low: `0x${low.toString(16)}`,
    high: `0x${high.toString(16)}`,
  };
}

function getAddress(key: "registry_address" | "poll_address" | "verifier_address", envKey: string): string {
  const deployed = loadDeployedAddresses() as Record<string, string>;
  const fromLocal = deployed[key];
  const fromEnv = process.env[envKey];
  const addr = fromLocal || fromEnv;
  if (!addr) {
    throw new Error(`Missing ${envKey}. Run deploy first or set ${envKey} in zk/.env`);
  }
  return normalizeHex(addr);
}

function buildAccount(provider: RpcProvider): Account {
  const address = process.env.ACCOUNT_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;
  if (!address || !privateKey) {
    throw new Error("Missing ACCOUNT_ADDRESS or PRIVATE_KEY in zk/.env");
  }

  return new Account({
    provider,
    address: normalizeHex(address),
    signer: new Signer(normalizeHex(privateKey)),
    cairoVersion: "1",
  });
}

function buildProvider(): RpcProvider {
  return new RpcProvider({
    nodeUrl: process.env.RPC_URL || "https://rpc.starknet-testnet.lava.build",
  });
}

async function addEligible(pollId: number, addresses: string[]) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const registry = new Contract(
    {
      abi: loadAbi("starkvote_VoterSetRegistry.contract_class.json"),
      address: getAddress("registry_address", "REGISTRY_ADDRESS"),
      providerOrAccount: account,
    }
  );

  console.log(`Adding ${addresses.length} eligible address(es) for poll ${pollId}...`);
  const tx = await registry.add_eligible_batch(pollId, addresses.map(normalizeHex));
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Eligible addresses added: ${tx.transaction_hash}`);
}

async function registerCommitment(pollId: number, commitment: string) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const registry = new Contract(
    {
      abi: loadAbi("starkvote_VoterSetRegistry.contract_class.json"),
      address: getAddress("registry_address", "REGISTRY_ADDRESS"),
      providerOrAccount: account,
    }
  );

  const commitmentU256 = toU256(commitment);
  console.log(`Registering commitment for poll ${pollId}: ${commitment}`);
  const tx = await registry.register_commitment(pollId, commitmentU256);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Commitment registered: ${tx.transaction_hash}`);
}

async function freezeRegistry(pollId: number) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const registry = new Contract(
    {
      abi: loadAbi("starkvote_VoterSetRegistry.contract_class.json"),
      address: getAddress("registry_address", "REGISTRY_ADDRESS"),
      providerOrAccount: account,
    }
  );

  const tx = await registry.freeze(pollId);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Voter set for poll ${pollId} frozen: ${tx.transaction_hash}`);
}

async function createPoll(
  pollId: number,
  optionsCount: number,
  startTime: number,
  endTime: number,
  root: string
) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const poll = new Contract(
    {
      abi: loadAbi("starkvote_Poll.contract_class.json"),
      address: getAddress("poll_address", "POLL_ADDRESS"),
      providerOrAccount: account,
    }
  );

  const tx = await poll.create_poll(pollId, optionsCount, startTime, endTime, toU256(root));
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Poll created: ${tx.transaction_hash}`);
}

async function submitVote(calldataPath: string) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const poll = new Contract(
    {
      abi: loadAbi("starkvote_Poll.contract_class.json"),
      address: getAddress("poll_address", "POLL_ADDRESS"),
      providerOrAccount: account,
    }
  );

  const calldata = JSON.parse(readFileSync(calldataPath, "utf-8"));
  const tx = await poll.vote(Number(calldata.poll_id), Number(calldata.option), calldata.full_proof_with_hints);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Vote submitted: ${tx.transaction_hash}`);
}

async function getTally(pollId: number, option: number) {
  const provider = buildProvider();
  const poll = new Contract(
    {
      abi: loadAbi("starkvote_Poll.contract_class.json"),
      address: getAddress("poll_address", "POLL_ADDRESS"),
      providerOrAccount: provider,
    }
  );
  const tally = await poll.get_tally(pollId, option);
  console.log(`Poll ${pollId}, option ${option}: ${tally.toString()}`);
}

async function finalize(pollId: number) {
  const provider = buildProvider();
  const account = buildAccount(provider);
  const poll = new Contract(
    {
      abi: loadAbi("starkvote_Poll.contract_class.json"),
      address: getAddress("poll_address", "POLL_ADDRESS"),
      providerOrAccount: account,
    }
  );
  const tx = await poll.finalize(pollId);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log(`Poll finalized: ${tx.transaction_hash}`);
}

async function getPoll(pollId: number) {
  const provider = buildProvider();
  const poll = new Contract(
    {
      abi: loadAbi("starkvote_Poll.contract_class.json"),
      address: getAddress("poll_address", "POLL_ADDRESS"),
      providerOrAccount: provider,
    }
  );
  const data = await poll.get_poll(pollId);
  console.log(JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "add-eligible":
      await addEligible(Number(process.argv[3]), process.argv.slice(4));
      return;
    case "register-commitment":
      await registerCommitment(Number(process.argv[3]), process.argv[4]);
      return;
    case "freeze-registry":
      await freezeRegistry(Number(process.argv[3]));
      return;
    case "create-poll":
      await createPoll(
        Number(process.argv[3]),
        Number(process.argv[4]),
        Number(process.argv[5]),
        Number(process.argv[6]),
        process.argv[7]
      );
      return;
    case "submit-vote":
      await submitVote(process.argv[3]);
      return;
    case "get-tally":
      await getTally(Number(process.argv[3]), Number(process.argv[4]));
      return;
    case "finalize":
      await finalize(Number(process.argv[3]));
      return;
    case "get-poll":
      await getPoll(Number(process.argv[3]));
      return;
    default:
      console.log(
        [
          "Usage:",
          "  npm run interact -- add-eligible <pollId> <address1> <address2> ...",
          "  npm run interact -- register-commitment <pollId> <commitment>",
          "  npm run interact -- freeze-registry <pollId>",
          "  npm run interact -- create-poll <pollId> <optionsCount> <startTime> <endTime> <root>",
          "  npm run interact -- submit-vote <samples/worldcoin_calldata.json>",
          "  npm run interact -- get-tally <pollId> <option>",
          "  npm run interact -- finalize <pollId>",
          "  npm run interact -- get-poll <pollId>",
        ].join("\n")
      );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
