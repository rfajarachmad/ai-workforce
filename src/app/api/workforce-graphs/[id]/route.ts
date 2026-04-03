import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateGraphBody {
  name?: string;
  graph?: unknown;
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const graph = await prisma.workforceGraph.findUnique({ where: { id } });

    if (!graph) {
      return NextResponse.json({ error: "Graph not found" }, { status: 404 });
    }

    return NextResponse.json({ data: graph });
  } catch {
    return NextResponse.json({ error: "Failed to fetch workforce graph" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateGraphBody;

    if (!body.graph) {
      return NextResponse.json({ error: "graph is required" }, { status: 400 });
    }

    const updated = await prisma.workforceGraph.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() || "Untitled Workforce Graph" } : {}),
        graph: body.graph as object,
      },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update workforce graph" }, { status: 500 });
  }
}
