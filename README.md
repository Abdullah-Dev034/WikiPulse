# WikiPulse

A live AI dashboard for Wikipedia: streams edits from Wikimedia EventStreams, keeps rolling
statistics, and uses an LLM to summarise trends and explain edits that look like vandalism.

> Work in progress. Full setup, architecture and decisions will be documented here as the
> project is built.

## Layout

| Path        | What                                                |
| ----------- | --------------------------------------------------- |
| `backend/`  | FastAPI service (Python 3.12+, managed with `uv`)   |
| `frontend/` | React + TypeScript dashboard (Vite, Tailwind)       |
| `docs/`     | Working notes                                       |

## Quick start (development)

```bash
# backend
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload

# frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Checks

```bash
cd backend && uv run ruff check . && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm test
```
