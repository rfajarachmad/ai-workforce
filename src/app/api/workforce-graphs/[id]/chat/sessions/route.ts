import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

interface CreateSessionBody {
  agentId?: string;
  title?: string;
}

async function backfillLegacyMessages(graphId: string, agentId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "WorkforceChatMessage"
      WHERE "graphId" = ${graphId} AND "agentId" = ${agentId} AND "sessionId" IS NULL
    `,
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count === 0) return;

  const sessionId = randomUUID();
  const now = new Date();
  const created = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      INSERT INTO "WorkforceChatSession" ("id", "graphId", "agentId", "title", "createdAt", "updatedAt")
      VALUES (${sessionId}, ${graphId}, ${agentId}, ${"Earlier conversation"}, ${now}, ${now})
      RETURNING "id"
    `,
  );
  const persistedSessionId = created[0]?.id;
  if (!persistedSessionId) return;

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "WorkforceChatMessage"
      SET "sessionId" = ${persistedSessionId}
      WHERE "graphId" = ${graphId} AND "agentId" = ${agentId} AND "sessionId" IS NULL
    `,
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id: graphId } = await context.params;
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    await backfillLegacyMessages(graphId, agentId);

    const sessions = await prisma.$queryRaw<
      Array<{
        id: string;
        graphId: string;
        agentId: string;
        title: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT "id", "graphId", "agentId", "title", "createdAt", "updatedAt"
      FROM "WorkforceChatSession"
      WHERE "graphId" = ${graphId} AND "agentId" = ${agentId}
      ORDER BY "updatedAt" DESC
    `);

    return NextResponse.json({
      data: sessions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to list chat sessions", error);
    return NextResponse.json({ error: "Failed to list chat sessions" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id: graphId } = await context.params;
    const body = (await request.json()) as CreateSessionBody;

    if (!body.agentId?.trim()) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const title =
      body.title?.trim() ||
      `Task · ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
    const sessionId = randomUUID();
    const now = new Date();

    const created = await prisma.$queryRaw<
      Array<{
        id: string;
        graphId: string;
        agentId: string;
        title: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      INSERT INTO "WorkforceChatSession" ("id", "graphId", "agentId", "title", "createdAt", "updatedAt")
      VALUES (${sessionId}, ${graphId}, ${body.agentId.trim()}, ${title}, ${now}, ${now})
      RETURNING "id", "graphId", "agentId", "title", "createdAt", "updatedAt"
    `);

    const row = created[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: {
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create chat session", error);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }
}
