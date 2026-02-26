import {
  Contract,
  RpcProvider,
  type Abi,
  type AccountInterface,
  type ProviderInterface,
} from "starknet";

import pollAbiJson from "@/lib/abi/poll.abi.json";
import registryAbiJson from "@/lib/abi/registry.abi.json";

export type CairoU256 = { low: string; high: string };

const U128_MASK = (1n << 128n) - 1n;

export const POLL_ABI = pollAbiJson as Abi;
export const REGISTRY_ABI = registryAbiJson as Abi;

export const DEFAULT_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://starknet-sepolia-rpc.publicnode.com";

export const DEFAULT_POLL_ADDRESS =
  process.env.NEXT_PUBLIC_POLL_ADDRESS ??
  "0x5e22619ec8cb23c0bc0bc3984198de8165d0ea32798e50decc229a86729deea";

export const DEFAULT_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  "0x2b202ccd6375fdf026d407d2921dfa2c71244fff42889c8cba482ff7cfa910b";

export function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function toBigIntValue(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid numeric value.");
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("Empty numeric value.");
    }
    return BigInt(trimmed);
  }

  if (typeof value === "object" && value !== null) {
    const map = value as Record<string, unknown>;
    if ("low" in map && "high" in map) {
      const low = toBigIntValue(map.low);
      const high = toBigIntValue(map.high);
      return low + (high << 128n);
    }
    if ("value" in map) {
      return toBigIntValue(map.value);
    }
  }

  throw new Error(`Unsupported numeric value: ${String(value)}`);
}

export function toU256(value: string | bigint): CairoU256 {
  const n = typeof value === "bigint" ? value : toBigIntValue(value);
  if (n < 0n) {
    throw new Error("u256 cannot be negative.");
  }
  const low = n & U128_MASK;
  const high = n >> 128n;
  return {
    low: `0x${low.toString(16)}`,
    high: `0x${high.toString(16)}`,
  };
}

export function fromU256(value: unknown): bigint {
  return toBigIntValue(value);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value !== 0n;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    return lowered === "true" || lowered === "1" || lowered === "0x1";
  }
  if (typeof value === "object" && value !== null) {
    const map = value as Record<string, unknown>;
    if ("True" in map) {
      return true;
    }
    if ("False" in map) {
      return false;
    }
  }
  return Boolean(value);
}

export function toAddress(value: unknown): string {
  if (typeof value === "string") {
    return normalizeHex(value);
  }
  if (typeof value === "bigint" || typeof value === "number") {
    return `0x${BigInt(value).toString(16)}`;
  }
  if (typeof value === "object" && value !== null) {
    const map = value as Record<string, unknown>;
    if ("contractAddress" in map) {
      return toAddress(map.contractAddress);
    }
    if ("address" in map) {
      return toAddress(map.address);
    }
  }
  return String(value);
}

export function parseAddressList(input: string): string[] {
  const parts = input
    .split(/[\s,]+/g)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeHex);

  return [...new Set(parts)];
}

export function formatUnixSeconds(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }
  return new Date(timestamp * 1000).toLocaleString();
}

export function createProvider(rpcUrl: string): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl });
}

type ProviderOrAccount = ProviderInterface | AccountInterface;

export function createPollContract(
  address: string,
  providerOrAccount: ProviderOrAccount,
): Contract {
  return new Contract({
    abi: POLL_ABI,
    address: normalizeHex(address),
    providerOrAccount,
  });
}

export function createRegistryContract(
  address: string,
  providerOrAccount: ProviderOrAccount,
): Contract {
  return new Contract({
    abi: REGISTRY_ABI,
    address: normalizeHex(address),
    providerOrAccount,
  });
}
