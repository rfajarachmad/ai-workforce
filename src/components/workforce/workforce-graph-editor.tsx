"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Position,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentWorkforceNode } from "./agent-workforce-node";
import { defaultAgentData, type AgentNodeData } from "./agent-types";

export type { AgentNodeData };

const initialNodes: Node<AgentNodeData>[] = [
  {
    id: "orchestrator",
    type: "agent",
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
    position: { x: 120, y: 140 },
    data: { ...defaultAgentData("Orchestrator Agent"), avatarEmoji: "🤖" },
  },
  {
    id: "researcher",
    type: "agent",
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
    position: { x: 440, y: 40 },
    data: { ...defaultAgentData("Research Agent"), avatarEmoji: "🔬" },
  },
  {
    id: "coder",
    type: "agent",
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
    position: { x: 440, y: 250 },
    data: { ...defaultAgentData("Coder Agent"), avatarEmoji: "💻" },
  },
];

const initialEdges: Edge[] = [
  { id: "e-orchestrator-researcher", source: "orchestrator", target: "researcher", animated: true },
  { id: "e-orchestrator-coder", source: "orchestrator", target: "coder", animated: true },
];

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-3-5-sonnet",
  "claude-3-opus",
  "gemini-2.0-flash",
] as const;

const SKILL_OPTIONS = [
  "web_search",
  "code_interpreter",
  "browser_automation",
  "file_system",
  "database_query",
  "api_caller",
] as const;

const AVATAR_EMOJI_OPTIONS = ["🤖", "🔬", "💻", "📊", "🎨", "⚙️", "🛡️", "🌐"] as const;
const LAST_GRAPH_ID_STORAGE_KEY = "workforce:lastGraphId";

function lastSessionStorageKey(graphId: string, agentId: string) {
  return `workforce:lastSession:${graphId}:${agentId}`;
}

interface PersistedGraphPayload {
  nodes?: Node<AgentNodeData>[];
  edges?: Edge[];
}

interface GraphApiResponse {
  data: {
    id: string;
    name: string;
    graph: PersistedGraphPayload;
    updatedAt: string;
  } | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  data: ChatMessage[];
}

interface ChatSessionRow {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionsListResponse {
  data: ChatSessionRow[];
}

export function WorkforceGraphEditor() {
  const nodeTypes = useMemo(() => ({ agent: AgentWorkforceNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [graphId, setGraphId] = useState<string | null>(null);
  const [graphName, setGraphName] = useState("My Workforce Graph");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeChatAgentId, setActiveChatAgentId] = useState<string>("orchestrator");
  const [chatInput, setChatInput] = useState("");
  const [sessionsByAgent, setSessionsByAgent] = useState<Record<string, ChatSessionRow[]>>({});
  const [activeSessionIdByAgent, setActiveSessionIdByAgent] = useState<Record<string, string | null>>(
    {},
  );
  const [messagesBySessionId, setMessagesBySessionId] = useState<Record<string, ChatMessage[] | undefined>>(
    {},
  );
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatusMessage, setChatStatusMessage] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined),
    [nodes, selectedNodeId],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((existingEdges) => addEdge({ ...connection, animated: true }, existingEdges));
    },
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<AgentNodeData>) => {
      setSelectedNodeId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateSelectedData = useCallback(
    (patch: Partial<AgentNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: { ...n.data, ...patch },
              }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const addAgentNode = useCallback(() => {
    setNodes((existingNodes) => {
      const nextCounter = existingNodes.length + 1;
      const newNode: Node<AgentNodeData> = {
        id: `agent-${nextCounter}`,
        type: "agent",
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        position: {
          x: 120 + (nextCounter % 4) * 180,
          y: 80 + (nextCounter % 3) * 130,
        },
        data: defaultAgentData(`Agent ${nextCounter}`),
      };

      return [...existingNodes, newNode];
    });
  }, [setNodes]);

  const toggleSkill = useCallback(
    (skill: string) => {
      if (!selectedNode?.data) return;
      const selectedSkills = selectedNode.data.skills ?? [];
      const nextSkills = selectedSkills.includes(skill)
        ? selectedSkills.filter((item) => item !== skill)
        : [...selectedSkills, skill];

      updateSelectedData({ skills: nextSkills });
    },
    [selectedNode, updateSelectedData],
  );

  const graphStats = useMemo(
    () => ({
      agents: nodes.length,
      handoffs: edges.length,
    }),
    [nodes.length, edges.length],
  );

  const chatAgents = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: node.data.label })),
    [nodes],
  );

  const activeChatAgent = useMemo(
    () => nodes.find((node) => node.id === activeChatAgentId),
    [activeChatAgentId, nodes],
  );

  const activeSessionId = activeSessionIdByAgent[activeChatAgentId] ?? null;

  const activeChatMessages = useMemo(() => {
    if (!activeSessionId) return [];
    return messagesBySessionId[activeSessionId] ?? [];
  }, [activeSessionId, messagesBySessionId]);

  const sessionsForActiveAgent = useMemo(
    () => sessionsByAgent[activeChatAgentId] ?? [],
    [activeChatAgentId, sessionsByAgent],
  );

  useEffect(() => {
    if (!nodes.some((node) => node.id === activeChatAgentId)) {
      setActiveChatAgentId(nodes[0]?.id ?? "");
    }
  }, [activeChatAgentId, nodes]);

  useEffect(() => {
    const hydrateGraph = async () => {
      try {
        const savedId = window.localStorage.getItem(LAST_GRAPH_ID_STORAGE_KEY);
        const endpoint = savedId
          ? `/api/workforce-graphs/${savedId}`
          : "/api/workforce-graphs";
        const response = await fetch(endpoint, { method: "GET" });

        if (!response.ok) {
          if (savedId) {
            window.localStorage.removeItem(LAST_GRAPH_ID_STORAGE_KEY);
          }
          return;
        }

        const result = (await response.json()) as GraphApiResponse;
        if (!result.data?.graph) return;

        const persistedNodes = Array.isArray(result.data.graph.nodes) ? result.data.graph.nodes : [];
        const persistedEdges = Array.isArray(result.data.graph.edges) ? result.data.graph.edges : [];

        if (persistedNodes.length > 0) {
          setNodes(persistedNodes);
          setEdges(persistedEdges);
          setGraphId(result.data.id);
          setGraphName(result.data.name);
          window.localStorage.setItem(LAST_GRAPH_ID_STORAGE_KEY, result.data.id);
          setSaveState("saved");
          setSaveMessage(`Loaded saved graph: ${result.data.name}`);
        }
      } catch {
        // Keep default in-memory graph when loading fails.
      }
    };

    void hydrateGraph();
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!graphId || !activeChatAgentId) return;

    let cancelled = false;

    const loadSessions = async () => {
      setSessionsLoading(true);
      setChatStatusMessage(null);
      try {
        const response = await fetch(
          `/api/workforce-graphs/${graphId}/chat/sessions?agentId=${encodeURIComponent(activeChatAgentId)}`,
        );
        if (!response.ok) throw new Error("Failed to fetch sessions");
        const result = (await response.json()) as SessionsListResponse;
        if (cancelled) return;

        const list = result.data ?? [];
        setSessionsByAgent((prev) => ({ ...prev, [activeChatAgentId]: list }));

        const stored = window.localStorage.getItem(lastSessionStorageKey(graphId, activeChatAgentId));
        const match = stored ? list.find((s) => s.id === stored) : undefined;
        const nextId = match?.id ?? list[0]?.id ?? null;
        setActiveSessionIdByAgent((prev) => ({ ...prev, [activeChatAgentId]: nextId }));
        if (nextId) {
          window.localStorage.setItem(lastSessionStorageKey(graphId, activeChatAgentId), nextId);
        }
      } catch {
        if (!cancelled) {
          setChatStatusMessage("Unable to load chat sessions for this agent.");
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    };

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [graphId, activeChatAgentId]);

  useEffect(() => {
    if (!graphId || !activeSessionId) return;
    if (messagesBySessionId[activeSessionId] !== undefined) return;

    let cancelled = false;

    const loadMessages = async () => {
      setChatLoading(true);
      try {
        const response = await fetch(
          `/api/workforce-graphs/${graphId}/chat?sessionId=${encodeURIComponent(activeSessionId)}`,
        );
        if (!response.ok) throw new Error("Failed to fetch messages");
        const result = (await response.json()) as ChatHistoryResponse;
        if (cancelled) return;
        setMessagesBySessionId((prev) => {
          if (prev[activeSessionId] !== undefined) return prev;
          return { ...prev, [activeSessionId]: result.data ?? [] };
        });
      } catch {
        if (!cancelled) {
          setChatStatusMessage("Unable to load messages for this session.");
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [graphId, activeSessionId, messagesBySessionId]);


  const saveGraph = useCallback(async () => {
    try {
      setSaveState("saving");
      setSaveMessage(null);

      const payload = {
        name: graphName,
        graph: { nodes, edges },
      };

      const response = await fetch(
        graphId ? `/api/workforce-graphs/${graphId}` : "/api/workforce-graphs",
        {
          method: graphId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save graph");
      }

      const result = (await response.json()) as {
        data: { id: string; updatedAt: string };
      };
      setGraphId(result.data.id);
      window.localStorage.setItem(LAST_GRAPH_ID_STORAGE_KEY, result.data.id);
      setSaveState("saved");
      setSaveMessage(`Saved at ${new Date(result.data.updatedAt).toLocaleTimeString()}`);
    } catch {
      setSaveState("error");
      setSaveMessage("Unable to save graph. Check API and database connection.");
    }
  }, [edges, graphId, graphName, nodes]);

  const selectSession = useCallback(
    (sessionId: string) => {
      if (!graphId) return;
      setActiveSessionIdByAgent((prev) => ({ ...prev, [activeChatAgentId]: sessionId }));
      window.localStorage.setItem(lastSessionStorageKey(graphId, activeChatAgentId), sessionId);
      setChatStatusMessage(null);
    },
    [activeChatAgentId, graphId],
  );

  const startNewTask = useCallback(async () => {
    if (!graphId || !activeChatAgentId) {
      setChatStatusMessage("Save the graph first, then start a new task.");
      return;
    }
    try {
      setChatStatusMessage(null);
      const response = await fetch(`/api/workforce-graphs/${graphId}/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activeChatAgentId }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      const result = (await response.json()) as { data: ChatSessionRow };
      const session = result.data;
      setSessionsByAgent((prev) => ({
        ...prev,
        [activeChatAgentId]: [session, ...(prev[activeChatAgentId] ?? [])],
      }));
      setActiveSessionIdByAgent((prev) => ({ ...prev, [activeChatAgentId]: session.id }));
      setMessagesBySessionId((prev) => ({ ...prev, [session.id]: [] }));
      window.localStorage.setItem(lastSessionStorageKey(graphId, activeChatAgentId), session.id);
    } catch {
      setChatStatusMessage("Could not start a new task session.");
    }
  }, [activeChatAgentId, graphId]);

  const sendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !activeChatAgent || !activeSessionId) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
      createdAt: now,
    };

    const skillSummary =
      activeChatAgent.data.skills.length > 0
        ? activeChatAgent.data.skills.join(", ")
        : "no configured skills";
    const roleSummary = activeChatAgent.data.jobDescription || activeChatAgent.data.description;

    const agentMessage: ChatMessage = {
      id: `${Date.now()}-agent`,
      role: "agent",
      content: `I am ${activeChatAgent.data.label} (${activeChatAgent.data.model}). ${
        roleSummary ? `Role: ${roleSummary}. ` : ""
      }Available skills: ${skillSummary}. You said: "${trimmed}".`,
      createdAt: new Date(Date.now() + 1).toISOString(),
    };

    setMessagesBySessionId((prev) => ({
      ...prev,
      [activeSessionId]: [...(prev[activeSessionId] ?? []), userMessage, agentMessage],
    }));
    setChatInput("");

    if (!graphId) {
      setChatStatusMessage("Save graph first to persist chat history.");
      return;
    }

    try {
      setChatStatusMessage(null);
      await Promise.all([
        fetch(`/api/workforce-graphs/${graphId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: activeChatAgentId,
            sessionId: activeSessionId,
            role: userMessage.role,
            content: userMessage.content,
          }),
        }),
        fetch(`/api/workforce-graphs/${graphId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: activeChatAgentId,
            sessionId: activeSessionId,
            role: agentMessage.role,
            content: agentMessage.content,
          }),
        }),
      ]);
      setSessionsByAgent((prev) => {
        const list = prev[activeChatAgentId] ?? [];
        const updated = list.map((s) =>
          s.id === activeSessionId ? { ...s, updatedAt: new Date().toISOString() } : s,
        );
        return { ...prev, [activeChatAgentId]: updated };
      });
    } catch {
      setChatStatusMessage("Message sent locally, but failed to persist history.");
    }
  }, [activeChatAgent, activeChatAgentId, activeSessionId, chatInput, graphId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm text-slate-300">
          <p className="font-medium text-white">Workforce Graph Builder</p>
          <p className="text-slate-400">
            Drag agents, connect handoffs, and design your execution flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            className="w-52 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="Graph name"
            aria-label="Graph name"
          />
          <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">
            Agents: {graphStats.agents}
          </span>
          <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">
            Handoffs: {graphStats.handoffs}
          </span>
          <button
            type="button"
            onClick={addAgentNode}
            className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            Add Agent
          </button>
          <button
            type="button"
            onClick={saveGraph}
            disabled={saveState === "saving"}
            className="rounded-md border border-emerald-500/60 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === "saving" ? "Saving..." : graphId ? "Update Graph" : "Save Graph"}
          </button>
        </div>
      </div>
      {saveMessage ? (
        <p
          className={`text-xs ${saveState === "error" ? "text-rose-400" : "text-emerald-300"}`}
          role="status"
        >
          {saveMessage}
        </p>
      ) : null}

      <div className="relative h-[65vh] min-h-[500px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          nodesDraggable
          nodesConnectable
          elementsSelectable
        >
          <MiniMap
            pannable
            zoomable
            className="!bg-slate-900"
            nodeColor="#0891b2"
            maskColor="rgba(2, 6, 23, 0.5)"
          />
          <Controls />
          <Background gap={16} size={1} />
        </ReactFlow>

        {selectedNode && selectedNode.data && (
          <aside
            className="absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-md"
            role="dialog"
            aria-labelledby="agent-config-title"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 p-4">
              <div>
                <h3 id="agent-config-title" className="text-lg font-semibold text-white">
                  Configure agent
                </h3>
                <p className="text-xs text-slate-500">Node ID: {selectedNode.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Name
                </span>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedData({ label: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Agent name"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Avatar
                </span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_EMOJI_OPTIONS.map((emoji) => {
                    const active = selectedNode.data.avatarEmoji === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => updateSelectedData({ avatarEmoji: emoji })}
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition",
                          active
                            ? "border-cyan-400 bg-slate-800 ring-1 ring-cyan-400/60"
                            : "border-slate-700 bg-slate-950 hover:border-slate-500",
                        ].join(" ")}
                        aria-label={`Avatar ${emoji}`}
                        aria-pressed={active}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">
                  Initials are derived from the name; the emoji appears on the node card.
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Description
                </span>
                <textarea
                  value={selectedNode.data.description}
                  onChange={(e) => updateSelectedData({ description: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="What this agent does"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Job Description
                </span>
                <textarea
                  value={selectedNode.data.jobDescription}
                  onChange={(e) => updateSelectedData({ jobDescription: e.target.value })}
                  rows={6}
                  className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Describe this agent’s role, responsibilities, and success criteria"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Model
                </span>
                <select
                  value={selectedNode.data.model}
                  onChange={(e) => updateSelectedData({ model: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Skills
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const isSelected = selectedNode.data.skills.includes(skill);
                    return (
                      <label
                        key={skill}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSkill(skill)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="font-mono text-xs">{skill}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">
                  Select one or more predefined skills for this agent.
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Agent Chat</h3>
            <p className="text-xs text-slate-400">
              Each task is a separate chat session. Use New Task for a fresh thread; open a previous task
              below to continue that session.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            Agent
            <select
              value={activeChatAgentId}
              onChange={(e) => setActiveChatAgentId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {chatAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startNewTask()}
            className="rounded-md border border-violet-500/70 bg-violet-500/20 px-3 py-1.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/30"
          >
            New Task
          </button>
          <span className="text-xs text-slate-500">Previous tasks</span>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {sessionsLoading ? (
              <span className="text-xs text-slate-500">Loading sessions…</span>
            ) : sessionsForActiveAgent.length === 0 ? (
              <span className="text-xs text-slate-500">No sessions yet — click New Task.</span>
            ) : (
              sessionsForActiveAgent.map((session) => {
                const isActive = session.id === activeSessionId;
                const label =
                  session.title?.trim() ||
                  new Date(session.updatedAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  });
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className={[
                      "max-w-[200px] truncate rounded-md border px-2 py-1 text-left text-xs transition",
                      isActive
                        ? "border-cyan-500 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500",
                    ].join(" ")}
                    title={label}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          {!activeSessionId ? (
            <p className="text-sm text-slate-500">
              No active session. Click <strong className="text-slate-300">New Task</strong> to start a
              chat, or pick a previous task above.
            </p>
          ) : chatLoading ? (
            <p className="text-sm text-slate-500">Loading messages…</p>
          ) : activeChatMessages.length === 0 ? (
            <p className="text-sm text-slate-500">
              Empty session — send a message to begin this task.
            </p>
          ) : (
            activeChatMessages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-cyan-500/20 text-cyan-100"
                    : "bg-slate-800 text-slate-100"
                }`}
              >
                <p>{message.content}</p>
              </div>
            ))
          )}
        </div>
        {chatStatusMessage ? <p className="mt-2 text-xs text-amber-300">{chatStatusMessage}</p> : null}

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void sendMessage();
              }
            }}
            disabled={!activeSessionId}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={
              activeSessionId ? "Type your message in this task…" : "Select or start a task to chat…"
            }
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!activeSessionId}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </section>
    </section>
  );
}
