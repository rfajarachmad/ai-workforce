export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  jobDescription: string;
  model: string;
  skills: string[];
  /** Optional emoji shown on the avatar ring (e.g. 🤖). */
  avatarEmoji?: string;
}

export function defaultAgentData(label: string): AgentNodeData {
  return {
    label,
    description: "",
    jobDescription: "",
    model: "gpt-4o",
    skills: [],
  };
}
