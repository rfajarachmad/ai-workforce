import { DynamicTool } from "@langchain/core/tools";
import { Calculator } from "@langchain/community/tools/calculator";
import type { StructuredToolInterface } from "@langchain/core/tools";

function buildWebSearchTool(): DynamicTool {
  return new DynamicTool({
    name: "web_search",
    description: "Search the web for current information. Input: a search query string.",
    func: async (input: string) => {
      if (!process.env.TAVILY_API_KEY) {
        return `[web_search] No search API key configured. Query: "${input}". Add TAVILY_API_KEY to .env to enable real search.`;
      }
      return `[web_search] TAVILY_API_KEY found but integration not wired. Query: "${input}"`;
    },
  });
}

function buildCalculatorTool(): Calculator {
  return new Calculator();
}

function buildSummarizeTool(): DynamicTool {
  return new DynamicTool({
    name: "summarize",
    description: "Summarize a long piece of text into key points. Input: the text to summarize.",
    func: async (input: string) => {
      const sentences = input.split(/[.!?]+/).filter(Boolean).slice(0, 3);
      return `Summary: ${sentences.join(". ")}.`;
    },
  });
}

type ToolFactory = () => StructuredToolInterface;

const SKILL_MAP: Record<string, ToolFactory> = {
  web_search: buildWebSearchTool,
  calculator: buildCalculatorTool,
  summarize: buildSummarizeTool,
};

export function resolveSkills(skills: string[]): StructuredToolInterface[] {
  return skills
    .filter((s) => s in SKILL_MAP)
    .map((s) => SKILL_MAP[s]());
}
