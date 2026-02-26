import { normalizeHex, toBigIntValue } from "@/lib/starkvote";
import { byteArray, type ByteArray } from "starknet";
import type { LifecycleBadge, PollStatus } from "./types";

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function toSafeNumber(value: unknown): number {
  return Number(toBigIntValue(value));
}

export function parseNonNegativeInt(raw: string, fieldName: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

export function parsePollId(raw: string): number {
  return parseNonNegativeInt(raw, "Poll ID");
}

export function txHashFromResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    throw new Error("Transaction response is invalid.");
  }

  const txHash = (result as { transaction_hash?: string }).transaction_hash;
  if (!txHash) {
    throw new Error("Missing transaction hash in response.");
  }

  return normalizeHex(txHash);
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

export function getLifecycle(status: PollStatus | null): LifecycleBadge {
  if (!status) {
    return { label: "No poll loaded", tone: "bg-zinc-100 text-zinc-700" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!status.frozen) {
    return { label: "Registration open", tone: "bg-sky-100 text-sky-800" };
  }
  if (!status.exists) {
    return { label: "Ready to open", tone: "bg-amber-100 text-amber-800" };
  }
  if (status.finalized) {
    return { label: "Finalized", tone: "bg-emerald-100 text-emerald-800" };
  }
  if (status.startTime > now) {
    return { label: "Scheduled", tone: "bg-violet-100 text-violet-800" };
  }
  if (status.endTime < now) {
    return { label: "Awaiting finalize", tone: "bg-orange-100 text-orange-800" };
  }

  return { label: "Voting live", tone: "bg-emerald-100 text-emerald-800" };
}

export function getMaxUnlockedStep(
  isWalletConnected: boolean,
  status: PollStatus | null,
): number {
  if (!isWalletConnected) {
    return 1;
  }

  const hasPollAdmin = (() => {
    if (!status?.pollAdmin) {
      return false;
    }
    try {
      return BigInt(normalizeHex(status.pollAdmin)) !== 0n;
    } catch {
      return false;
    }
  })();
  const isFrozen = Boolean(status?.frozen);
  const pollExists = Boolean(status?.exists);

  let maxUnlockedStep = 2;
  if (isFrozen || pollExists) {
    maxUnlockedStep = 3;
  }
  if (pollExists) {
    maxUnlockedStep = 4;
  }

  return maxUnlockedStep;
}

export function isConnectedWalletPollAdmin(
  status: PollStatus | null,
  walletAddress: string,
): boolean {
  if (!status || !walletAddress) {
    return false;
  }

  try {
    return (
      BigInt(normalizeHex(status.pollAdmin)) !== 0n &&
      BigInt(normalizeHex(status.pollAdmin)) ===
        BigInt(normalizeHex(walletAddress))
    );
  } catch {
    return false;
  }
}

export function parseOptionLabels(input: string): string[] {
  return input
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function decodeByteArrayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    try {
      return byteArray.stringFromByteArray(value as ByteArray);
    } catch {
      // Fall through to a best-effort string cast.
    }
  }
  return String(value ?? "");
}


