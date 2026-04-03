import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

interface ChatMessageBody {
  agentId?: string;
  sessionId?: string;
  role?: "user" | "agent";
  content?: string;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const messages = await prisma.$queryRaw<
      Array<{
        id: string;
        graphId: string;
        agentId: string;
        sessionId: string | null;
        role: string;
        content: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT "id", "graphId", "agentId", "sessionId", "role", "content", "createdAt"
      FROM "WorkforceChatMessage"
      WHERE "graphId" = ${id} AND "sessionId" = ${sessionId}
      ORDER BY "createdAt" ASC
    `);

    return NextResponse.json({
      data: messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Chat tables are missing. Run `npm run prisma:push` to sync latest schema.",
        },
        { status: 500 },
      );
    }

    console.error("Failed to fetch chat history", error);
    return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as ChatMessageBody;

    if (!body.agentId || !body.sessionId || !body.role || !body.content?.trim()) {
      return NextResponse.json(
        { error: "agentId, sessionId, role, and content are required" },
        { status: 400 },
      );
    }
    const messageId = randomUUID();
    const now = new Date();

    const created = await prisma.$queryRaw<
      Array<{
        id: string;
        graphId: string;
        agentId: string;
        sessionId: string | null;
        role: string;
        content: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
      INSERT INTO "WorkforceChatMessage" ("id", "graphId", "agentId", "sessionId", "role", "content", "createdAt")
      VALUES (${messageId}, ${id}, ${body.agentId}, ${body.sessionId}, ${body.role}, ${body.content.trim()}, ${now})
      RETURNING "id", "graphId", "agentId", "sessionId", "role", "content", "createdAt"
    `);

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "WorkforceChatSession"
        SET "updatedAt" = NOW()
        WHERE "id" = ${body.sessionId}
      `,
    );

    return NextResponse.json(
      {
        data: {
          ...created[0],
          createdAt: created[0].createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Chat tables are missing. Run `npm run prisma:push` to sync latest schema.",
        },
        { status: 500 },
      );
    }

    console.error("Failed to save chat message", error);
    return NextResponse.json({ error: "Failed to save chat message" }, { status: 500 });
  }
}
