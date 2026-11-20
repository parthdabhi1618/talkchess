# TalkChess

A code-editor-styled chess platform with an AI coach grounded in Stockfish analysis.

Play against Stockfish, watch a live evaluation bar, and ask a local LLM coach about any position. Every evaluation, best move, and move classification comes from the engine — the language model only explains those results, so the coaching stays grounded in real analysis.

## Features

- Play against Stockfish with a live, color-graded eval bar
- Eval-colored move list and board highlights
- Engine-grounded LLM chat coach powered by Ollama (tool-calling)
- Structured, explainable per-move feedback
- Game history, per-move stats, and profile pages
- Progressive analysis streaming (no frozen UI during deep analysis)

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, react-chessboard, chess.js |
| Backend | Express, TypeScript, tsx |
| Database | SQLite via Prisma |
| Chess engine | Stockfish |
| LLM | Ollama (local, tool-calling) |

## Project structure

```
dep_talkchess/
├── backend/     Express API, Prisma/SQLite, Stockfish engine pool, Ollama orchestrator
└── frontend/    React + Vite board, panels, pages, and styles
```

## Getting started

### Prerequisites

- Node.js 18 or newer
- Ollama running locally with a tool-capable model (see `backend/.env.example`)

### Backend

```bash
cd backend
npm install
cp .env.example .env        # adjust values if needed
npx prisma db push
npm run dev
# API → http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App → http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to the backend on port 3001.

## Configuration

Backend settings live in `backend/.env`:

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | Prisma SQLite connection string | `file:./dev.db` |
| `PORT` | API server port | `3001` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model used by the coach | `qwen3.5:4b` |

## Scripts

**Backend** (`cd backend`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled build |
| `npm run db:push` | Sync the Prisma schema to the database |

**Frontend** (`cd frontend`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |

## API

The REST API is mounted under `/api`:

- `/api/auth` — registration and login
- `/api/games` — create, list, and update games
- `/api/analyze` — Stockfish analysis (plus a streaming variant)
- `/api/features` — structured, explainable per-move features
- `/api/stats` — per-user statistics

Chat runs over WebSocket at `/ws/chat`. A health check is available at `/health`.

## Database

SQLite via Prisma; the schema is in `backend/prisma/schema.prisma`. To switch to PostgreSQL, change the `provider` in the `datasource` block and update `DATABASE_URL` in `.env`.
