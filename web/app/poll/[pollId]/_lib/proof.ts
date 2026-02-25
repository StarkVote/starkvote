import type { GeneratedProofPayload, ImportedIdentity } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Identity file must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function expectString(
  map: Record<string, unknown>,
  key: string,
  label: string,
  required = false,
): string | undefined {
  const value = map[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`${label} is missing in identity file.`);
    }
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${label}[${index}] must be a string.`);
    }
    return item;
  });
}

export function parseIdentityJson(input: string): ImportedIdentity {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Identity file is not valid JSON.");
  }

  const map = asRecord(parsed);
  const serialized = expectString(map, "serialized", "serialized", true);
  if (!serialized) {
    throw new Error("serialized is missing in identity file.");
  }
  const commitment =
    expectString(map, "commitment", "commitment") ??
    expectString(map, "identityCommitment", "identityCommitment");

  return {
    serialized,
    commitment,
  };
}

export async function requestProofGeneration(params: {
  pollId: string;
  option: number;
  identitySerialized: string;
}): Promise<GeneratedProofPayload> {
  const response = await fetch(`/api/poll/${encodeURIComponent(params.pollId)}/proof`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      option: params.option,
      identitySerialized: params.identitySerialized,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const value = (payload as { error?: unknown }).error;
      if (typeof value === "string" && value.trim()) {
        throw new Error(value);
      }
    }
    throw new Error("Failed to generate proof.");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid proof response.");
  }

  const map = payload as Record<string, unknown>;

  const pollId = map.poll_id;
  const option = map.option;
  const leafIndex = map.leaf_index;
  const leafCount = map.leaf_count;

  if (
    typeof pollId !== "string" ||
    !pollId.trim() ||
    typeof option !== "number" ||
    !Number.isInteger(option) ||
    typeof leafIndex !== "number" ||
    !Number.isInteger(leafIndex) ||
    typeof leafCount !== "number" ||
    !Number.isInteger(leafCount)
  ) {
    throw new Error("Proof response shape is invalid.");
  }
  const normalizedPollId = pollId.trim();

  return {
    poll_id: normalizedPollId,
    option,
    leaf_index: leafIndex,
    leaf_count: leafCount,
    full_proof_with_hints: ensureStringArray(
      map.full_proof_with_hints,
      "full_proof_with_hints",
    ),
    public_signals: ensureStringArray(map.public_signals, "public_signals"),
  };
}

export function resolveIdentitySerialized(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Identity is required.");
  }
  try {
    const identity = parseIdentityJson(trimmed);
    return identity.serialized;
  } catch {
    return trimmed;
  }
}
