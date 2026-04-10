# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Warning:** This project uses Next.js 16 — a version with breaking API changes from what exists in training data. Always read `node_modules/next/dist/docs/` before writing Next.js-specific code and heed any deprecation notices.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:push      # Push schema to DB (no migration files)
```

**Environment:** Requires `DATABASE_URL` (PostgreSQL connection string) in `.env`.

## Architecture

This is a Next.js 16 App Router application. All pages use the `src/app/` directory with Tailwind CSS v4 for styling.

### Data flow

1. **Graph persistence** — `WorkforceGraph` rows store the entire node/edge graph as a JSON blob. The client uses `localStorage` (`workforce:lastGraphId`) to remember which graph to load on boot. If no ID is stored, `GET /api/workforce-graphs` returns the most recently updated graph.

2. **Chat sessions** — Each agent within a saved graph has independent `WorkforceChatSession` rows. The active session per agent is also tracked in `localStorage` (`workforce:lastSession:{graphId}:{agentId}`). Messages are stored in `WorkforceChatMessage`. Sessions list endpoint (`GET /api/workforce-graphs/[id]/chat/sessions`) runs a legacy-message backfill on every call to adopt pre-session messages.

3. **Chat messages** — The POST/GET chat endpoints use `prisma.$queryRaw` with `Prisma.sql` tagged templates (not the standard Prisma model API) because the tables were added after initial generation. If `P2021` is returned, the tables are missing — run `npm run prisma:push`.

### Key files

| Path | Purpose |
|---|---|
| `src/components/workforce/workforce-graph-editor.tsx` | Main client component — owns all graph, session, and chat state |
| `src/components/workforce/agent-workforce-node.tsx` | React Flow custom node renderer (memoized) |
| `src/components/workforce/agent-types.ts` | `AgentNodeData` interface and `defaultAgentData` factory |
| `src/lib/prisma.ts` | Singleton Prisma client with adapter-pg; detects stale cached client missing `workforceChatMessage` |
| `src/app/api/workforce-graphs/route.ts` | `GET` (latest graph) / `POST` (create graph) |
| `src/app/api/workforce-graphs/[id]/route.ts` | `GET` / `PUT` by graph ID |
| `src/app/api/workforce-graphs/[id]/chat/route.ts` | `GET` (messages by sessionId) / `POST` (append message) |
| `src/app/api/workforce-graphs/[id]/chat/sessions/route.ts` | `GET` (list sessions + backfill) / `POST` (create session) |
| `prisma/schema.prisma` | Three models: `WorkforceGraph`, `WorkforceChatSession`, `WorkforceChatMessage` |

### API shape

All API routes return `{ data: ... }` on success and `{ error: string }` on failure. Route params in Next.js 16 are `Promise`-wrapped: handlers must `await context.params` before destructuring.

### React Flow integration

`WorkforceGraphEditor` uses `@xyflow/react` v12. The custom `agent` node type is defined as `{ agent: AgentWorkforceNode }` and passed to `nodeTypes` via `useMemo` to avoid re-renders. Node data shape is `AgentNodeData`. Connecting two nodes sets `animated: true` on the edge automatically.

### Agent chat (current state)

Agent responses are currently **simulated client-side** — the `sendMessage` function constructs a reply from the agent's label, model, and skills without calling any LLM API. Both the user message and the synthetic agent reply are immediately appended to local state, then persisted via two parallel `POST /api/workforce-graphs/[id]/chat` calls.
