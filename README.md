# AI Workforce

AI Workforce is a Next.js app for designing a multi-agent workflow graph and chatting with each agent using session-based conversations.

## What we are building

- A visual workforce editor using React Flow (`/workforce`)
- Custom agent nodes with:
  - name
  - description
  - job description
  - model
  - skills
  - avatar emoji
- Graph persistence to PostgreSQL with Prisma
- Chat per agent with **task sessions**:
  - `New Task` creates a fresh chat session
  - `Previous tasks` lets you reopen older sessions
  - messages persist across refresh

## Tech stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- React Flow (`@xyflow/react`)
- Prisma + PostgreSQL

## Project structure

- `src/app/workforce/page.tsx`: workforce page
- `src/components/workforce/workforce-graph-editor.tsx`: graph editor + chat UI
- `src/app/api/workforce-graphs/route.ts`: create/read latest graph
- `src/app/api/workforce-graphs/[id]/route.ts`: read/update one graph
- `src/app/api/workforce-graphs/[id]/chat/route.ts`: chat messages API
- `src/app/api/workforce-graphs/[id]/chat/sessions/route.ts`: chat sessions API
- `prisma/schema.prisma`: data models
- `docker-compose.yml`: local PostgreSQL service

## Database models

- `WorkforceGraph`: stores graph metadata and JSON graph payload (`nodes`, `edges`)
- `WorkforceChatSession`: stores task/session per graph + agent
- `WorkforceChatMessage`: stores messages inside a session

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Start PostgreSQL

```bash
docker compose up -d
```

### 3) Configure environment

Copy `.env.example` to `.env` and ensure `DATABASE_URL` is valid.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_workforce?schema=public"
```

### 4) Sync Prisma schema

```bash
npm run prisma:generate
npm run prisma:push
```

### 5) Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then go to `/workforce`.

## Available scripts

- `npm run dev`: start dev server
- `npm run build`: create production build
- `npm run start`: start production server
- `npm run lint`: run ESLint
- `npm run prisma:generate`: generate Prisma client
- `npm run prisma:push`: push schema to database

## Current behavior notes

- A chat **task** equals one `WorkforceChatSession`.
- New messages are written to the selected session.
- Session timestamps are updated on new messages.
- Legacy messages without a session are backfilled into an "Earlier conversation" session when sessions are loaded.

## Troubleshooting

- If you see chat/session table errors:
  - run `npm run prisma:push`
  - restart dev server if needed
- If `New Task` fails:
  - check API logs from `src/app/api/workforce-graphs/[id]/chat/sessions/route.ts`
  - verify PostgreSQL is running and reachable via `DATABASE_URL`
