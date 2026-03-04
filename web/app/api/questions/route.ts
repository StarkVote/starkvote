import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const pollId = request.nextUrl.searchParams.get("pollId");

    if (!pollId) {
      return NextResponse.json(
        { error: "pollId query param is required" },
        { status: 400 }
      );
    }

    const record = await prisma.question.findFirst({
      where: { pollId },
    });

    if (!record) {
      return NextResponse.json({ question: null });
    }

    return NextResponse.json(record);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pollId, question } = body;

    if (!pollId || !question) {
      return NextResponse.json(
        { error: "pollId and question are required" },
        { status: 400 }
      );
    }

    const created = await prisma.question.create({
      data: { pollId, question },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}
