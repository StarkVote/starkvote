import { normalizeHex, toBigIntValue, toBoolean } from "@/lib/starkvote";

import type { ParsedVotePayload, PollDetails } from "./types";

const U64_MAX = (1n << 64n) - 1n;
const U8_MAX = 255n;

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function readField(raw: unknown, key: string, index: number): unknown {
  if (typeof raw === "object" && raw !== null && key in raw) {
    return (raw as Record<string, unknown>)[key];
  }
  if (Array.isArray(raw) && index < raw.length) {
    return raw[index];
  }
  return undefined;
}

function toSafeNumber(value: unknown): number {
  const bigintValue = toBigIntValue(value ?? 0);
  if (bigintValue < 0n) {
    return 0;
  }
  if (bigintValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(bigintValue);
}

function normalizeFelt(value: unknown): string {
  const felt = toBigIntValue(value);
  if (felt < 0n) {
    throw new Error("Proof calldata values must be unsigned felts.");
  }
  return toHex(felt);
}

export function formatShortHash(value: string | null, left = 8, right = 6): string {
  if (!value) {
    return "-";
  }
  const normalized = normalizeHex(value);
  if (normalized.length <= left + right + 2) {
    return normalized;
  }
  return `${normalized.slice(0, left + 2)}...${normalized.slice(-right)}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function parseU64(value: unknown, label: string): bigint {
  const parsed = toBigIntValue(value);
  if (parsed < 0n || parsed > U64_MAX) {
    throw new Error(`${label} must be a valid u64.`);
  }
  return parsed;
}

export function parseU8(value: unknown, label: string): number {
  const parsed = toBigIntValue(value);
  if (parsed < 0n || parsed > U8_MAX) {
    throw new Error(`${label} must be between 0 and 255.`);
  }
  return Number(parsed);
}

export function parseVotePayload(input: string): ParsedVotePayload {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Proof calldata is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const values = trimmed
      .split(/[\s,]+/g)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeFelt);
    if (values.length === 0) {
      throw new Error("Invalid proof calldata.");
    }
    return { proof: values };
  }

  if (Array.isArray(parsed)) {
    return { proof: parsed.map(normalizeFelt) };
  }

  if (typeof parsed === "object" && parsed !== null) {
    const map = parsed as Record<string, unknown>;
    const proofCandidate = map.full_proof_with_hints;
    if (Array.isArray(proofCandidate)) {
      const next: ParsedVotePayload = {
        proof: proofCandidate.map(normalizeFelt),
      };
      if (map.option !== undefined) {
        next.option = parseU8(map.option, "Option in proof payload");
      }
      if (map.poll_id !== undefined) {
        next.payloadPollId = parseU64(map.poll_id, "Poll ID in proof payload");
      }
      return next;
    }
  }

  throw new Error(
    "Paste either a JSON felt array or the full worldcoin_calldata.json payload.",
  );
}

export function parsePollDetails(raw: unknown): PollDetails {
  const snapshotRoot = toBigIntValue(readField(raw, "snapshot_root", 4) ?? 0);
  return {
    exists: toBoolean(readField(raw, "exists", 0)),
    optionsCount: toSafeNumber(readField(raw, "options_count", 1)),
    startTime: toSafeNumber(readField(raw, "start_time", 2)),
    endTime: toSafeNumber(readField(raw, "end_time", 3)),
    snapshotRootHex: toHex(snapshotRoot),
    finalized: toBoolean(readField(raw, "finalized", 5)),
    winnerOption: toSafeNumber(readField(raw, "winner_option", 6)),
    maxVotes: toSafeNumber(readField(raw, "max_votes", 7)),
  };
}

export function getTxHash(value: unknown): string {
  if (typeof value === "object" && value !== null && "transaction_hash" in value) {
    return normalizeHex(
      String((value as { transaction_hash?: unknown }).transaction_hash ?? ""),
    );
  }
  throw new Error("Transaction hash missing from wallet response.");
}
