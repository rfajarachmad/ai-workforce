import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { AgentNodeData } from "@/components/workforce/agent-types";

const GEMINI_MODELS = new Set([
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]);

function resolveGeminiModel(model: string): string {
  if (GEMINI_MODELS.has(model)) return model;
  return "gemini-2.5-flash-lite";
}

function buildSystemPrompt(data: AgentNodeData): string {
  const role = [data.description, data.jobDescription].filter(Boolean).join(" ");
  return role
    ? `You are ${data.label}. ${role}\n\nThink step by step. Use the tools available to you to complete tasks.`
    : `You are ${data.label}. Think step by step. Use the tools available to you to complete tasks.`;
}

export function buildReactAgent(
  data: AgentNodeData,
  tools: StructuredToolInterface[],
) {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY in environment. Add it to your .env file.");
  }

  const llm = new ChatGoogleGenerativeAI({
    model: resolveGeminiModel(data.model || ""),
    temperature: 0,
    streaming: true,
    apiKey,
    maxRetries: 1,
  });

  // Pass a plain string — createReactAgent treats it as a system message prepended to every run.
  // This avoids ChatPromptTemplate variable-binding issues with LangGraph's internal invoke contract.
  const prompt = buildSystemPrompt(data);

  return createReactAgent({ llm, tools, prompt });
}
