import { NextResponse } from "next/server";

import { generateProofCalldataForPoll } from "@/lib/server/proof-generation";

type RouteContext = {
  params: Promise<{ pollId: string }>;
};

type ProofRequestBody = {
  option?: unknown;
  identitySerialized?: unknown;
};

function parsePollId(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Poll ID is required.");
  }
  const parsed = BigInt(trimmed);
  const maxU64 = (1n << 64n) - 1n;
  if (parsed < 0n || parsed > maxU64) {
    throw new Error("Poll ID must be a valid u64.");
  }
  return parsed;
}

function parseOption(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Option must be an integer.");
  }
  if (value < 0 || value > 255) {
    throw new Error("Option must be between 0 and 255.");
  }
  return value;
}

function parseIdentitySerialized(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("identitySerialized is required.");
  }
  return value.trim();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { pollId: pollIdParam } = await params;
    const body = (await request.json()) as ProofRequestBody;

    const pollId = parsePollId(pollIdParam);
    const option = parseOption(body.option);
    const identitySerialized = parseIdentitySerialized(body.identitySerialized);

    const payload = await generateProofCalldataForPoll({
      pollId,
      option,
      identitySerialized,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = toErrorMessage(error);
    const lower = message.toLowerCase();
    const status =
      lower.includes("required") ||
      lower.includes("invalid") ||
      lower.includes("must") ||
      lower.includes("not found") ||
      lower.includes("does not exist")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
