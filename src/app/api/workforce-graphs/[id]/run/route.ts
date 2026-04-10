import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compileGraph } from "@/lib/langchain/graph-compiler";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import type { Node, Edge } from "@xyflow/react";
import type { AgentNodeData } from "@/components/workforce/agent-types";

interface RunRequestBody {
  rootAgentId?: string;
  input?: string;
  sessionId?: string;
}

interface SSEEvent {
  type: "step" | "message" | "error" | "done";
  agentId?: string;
  content: string;
}

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function persistMessage(
  graphId: string,
  agentId: string,
  sessionId: string,
  role: string,
  content: string,
) {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "WorkforceChatMessage" ("id", "graphId", "agentId", "sessionId", "role", "content", "createdAt")
    VALUES (${id}, ${graphId}, ${agentId}, ${sessionId}, ${role}, ${content}, ${now})
  `);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "WorkforceChatSession" SET "updatedAt" = NOW() WHERE "id" = ${sessionId}
  `);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: graphId } = await context.params;
  const body = (await request.json()) as RunRequestBody;

  if (!body.rootAgentId || !body.input?.trim() || !body.sessionId) {
    return NextResponse.json(
      { error: "rootAgentId, input, and sessionId are required" },
      { status: 400 },
    );
  }

  const graphRow = await prisma.workforceGraph.findUnique({ where: { id: graphId } });
  if (!graphRow) {
    return NextResponse.json({ error: "Graph not found" }, { status: 404 });
  }

  const graphData = graphRow.graph as unknown as { nodes: Node<AgentNodeData>[]; edges: Edge[] };
  const rootNode = graphData.nodes.find((n) => n.id === body.rootAgentId);
  if (!rootNode) {
    return NextResponse.json({ error: "rootAgentId not found in graph" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SSEEvent) =>
        controller.enqueue(new TextEncoder().encode(encodeSSE(event)));

      try {
        // Persist the user message first
        await persistMessage(graphId, body.rootAgentId!, body.sessionId!, "user", body.input!);

        enqueue({
          type: "step",
          agentId: body.rootAgentId,
          content: `Starting ${rootNode.data.label}…`,
        });

        // Compile entire graph — child agents become delegate tools on parents
        console.log("[run] compiling graph...");
        const agentMap = await compileGraph(graphData, (agentId, type, content) => {
          enqueue({ type: "step", agentId, content });
        });
        console.log("[run] graph compiled, nodes:", [...agentMap.keys()]);

        const rootAgent = agentMap.get(body.rootAgentId!);
        if (!rootAgent) throw new Error("Could not build root agent");

        // finalOutput is updated by each on_chat_model_end event.
        // The last one (after all tool calls) is the agent's final answer.
        let finalOutput = "";

        console.log("[run] starting streamEvents...");
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
          console.error("[run] streamEvents timed out after 60s");
        }, 60_000);

        const eventStream = rootAgent.streamEvents(
          { messages: [new HumanMessage(body.input!)] },
          { version: "v2", signal: abortController.signal },
        );

        for await (const event of eventStream) {
          console.log("[run] event:", event.event, event.name ?? "");
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data?.chunk;
            const token =
              typeof chunk?.content === "string"
                ? chunk.content
                : Array.isArray(chunk?.content)
                  ? (chunk.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("")
                  : "";
            if (token) {
              enqueue({ type: "step", agentId: body.rootAgentId, content: token });
            }
          } else if (event.event === "on_chat_model_end") {
            // Capture the complete text after each LLM call — last one wins
            const output = event.data?.output;
            const content =
              typeof output?.content === "string"
                ? output.content
                : Array.isArray(output?.content)
                  ? (output.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("")
                  : "";
            if (content) finalOutput = content;
          } else if (event.event === "on_tool_start") {
            enqueue({
              type: "step",
              agentId: body.rootAgentId,
              content: `\n[tool: ${event.name}] ${JSON.stringify(event.data?.input ?? "")}`,
            });
          } else if (event.event === "on_tool_end") {
            enqueue({
              type: "step",
              agentId: body.rootAgentId,
              content: `\n[result] ${String(event.data?.output ?? "").slice(0, 300)}`,
            });
          }
        }

        clearTimeout(timeout);
        console.log("[run] streamEvents done. finalOutput length:", finalOutput.length);

        if (finalOutput) {
          await persistMessage(graphId, body.rootAgentId!, body.sessionId!, "agent", finalOutput);
          enqueue({ type: "message", agentId: body.rootAgentId, content: finalOutput });
        } else {
          enqueue({ type: "error", content: "Agent finished but returned no output." });
        }

        enqueue({ type: "done", content: "Run complete." });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[run route]", err);
        enqueue({ type: "error", content: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
