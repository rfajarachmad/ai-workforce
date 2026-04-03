import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SaveGraphBody {
  name?: string;
  graph?: unknown;
}

export async function GET() {
  try {
    const latest = await prisma.workforceGraph.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: latest });
  } catch {
    return NextResponse.json({ error: "Failed to fetch workforce graph" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveGraphBody;

    if (!body.graph) {
      return NextResponse.json({ error: "graph is required" }, { status: 400 });
    }

    const created = await prisma.workforceGraph.create({
      data: {
        name: body.name?.trim() || "Untitled Workforce Graph",
        graph: body.graph as object,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workforce graph" }, { status: 500 });
  }
}
