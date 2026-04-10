import type { Node, Edge } from "@xyflow/react";
import type { AgentNodeData } from "@/components/workforce/agent-types";
import { resolveSkills } from "./skills/registry";
import { buildReactAgent } from "./agent-builder";
import { buildDelegateTool, type CompiledAgent, type StepCallback } from "./delegate-tool";

interface GraphData {
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
}

/**
 * Topological sort (Kahn's algorithm, outgoing = child edges).
 * Leaf nodes (no outgoing edges) are built first so child agents exist
 * before their parents try to wrap them as delegate tools.
 */
function topologicalSort(nodes: Node<AgentNodeData>[], edges: Edge[]): Node<AgentNodeData>[] {
  const outDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));

  for (const e of edges) {
    outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1);
  }

  // Start with leaves (out-degree = 0)
  const queue = nodes.filter((n) => outDegree.get(n.id) === 0);
  const sorted: Node<AgentNodeData>[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    sorted.push(node);

    // For each parent that points TO this node, decrement its remaining children count
    for (const e of edges) {
      if (e.target === node.id) {
        const remaining = (outDegree.get(e.source) ?? 0) - 1;
        outDegree.set(e.source, remaining);
        if (remaining === 0) {
          const parent = nodes.find((n) => n.id === e.source);
          if (parent && !visited.has(parent.id)) queue.push(parent);
        }
      }
    }
  }

  // Append any remaining nodes (handles disconnected nodes or cycles gracefully)
  for (const n of nodes) {
    if (!visited.has(n.id)) sorted.push(n);
  }

  return sorted;
}

/**
 * Compile a workforce graph into a Map of compiled ReAct agents.
 * Each outgoing edge from A → B becomes a delegate DynamicTool on A.
 */
export async function compileGraph(
  graphData: GraphData,
  onStep?: StepCallback,
): Promise<Map<string, CompiledAgent>> {
  const { nodes, edges } = graphData;
  const agentMap = new Map<string, CompiledAgent>();

  const sorted = topologicalSort(nodes, edges);

  for (const node of sorted) {
    const data = node.data as AgentNodeData;

    const skillTools = resolveSkills(data.skills ?? []);

    const delegateTools = edges
      .filter((e) => e.source === node.id)
      .flatMap((e) => {
        const childAgent = agentMap.get(e.target);
        const childNode = nodes.find((n) => n.id === e.target);
        if (!childAgent || !childNode) return [];
        return [buildDelegateTool(e.target, childNode.data as AgentNodeData, childAgent, onStep)];
      });

    const tools = [...skillTools, ...delegateTools];
    const agent = buildReactAgent(data, tools);
    agentMap.set(node.id, agent);
  }

  return agentMap;
}
