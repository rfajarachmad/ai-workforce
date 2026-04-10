import { DynamicTool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentNodeData } from "@/components/workforce/agent-types";
import type { buildReactAgent } from "./agent-builder";

export type CompiledAgent = ReturnType<typeof buildReactAgent>;
export type StepCallback = (agentId: string, type: string, content: string) => void;

/**
 * Wraps a child compiled ReAct agent as a DynamicTool so a parent agent
 * can delegate tasks to it (i.e. traverse an edge in the graph).
 */
export function buildDelegateTool(
  nodeId: string,
  data: AgentNodeData,
  agent: CompiledAgent,
  onStep?: StepCallback,
): DynamicTool {
  const description =
    data.jobDescription ||
    data.description ||
    `Delegate a task to ${data.label}.`;

  // Tool names must match [a-zA-Z0-9_-]+
  const name = `delegate_to_${data.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${nodeId.slice(-6)}`;

  return new DynamicTool({
    name,
    description: `${description} Input: the task or question to send to ${data.label}.`,
    func: async (input: string) => {
      onStep?.(nodeId, "tool_start", `Delegating to ${data.label}: ${input}`);

      const result = await agent.invoke({ messages: [new HumanMessage(input)] });

      const lastMsg = result.messages?.[result.messages.length - 1];
      const output =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? result);

      onStep?.(nodeId, "tool_end", output);
      return output;
    },
  });
}
