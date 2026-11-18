# AI working notes

Raw notes kept during development; distilled into `AI_LOG.md` before submission.

## Planning (ChatGPT, before coding)

- Asked for an architecture and plan for the brief. Kept: modular monolith, FastAPI,
  WebSocket to the browser, bounded in-memory store, rule-based vandalism signals.
- **Wrong:** its rolling-window sketch evicted events by `datetime.now()`. Replaying the
  recorded `sample_events.jsonl` would expire every event immediately. Changed to event-time
  windows (window end = newest event timestamp seen).
- **Wrong:** its risk-score sketch used `if event.old_length and ...`; a new page has
  `old_length == 0`, which is falsy, so page creations were never scored.
- **Rejected:** seven REST endpoints. One snapshot builder serves REST and WebSocket.

## Phase 0 – scaffold (Claude Code)

- Scaffolded backend (uv, FastAPI, Ruff, pytest) and frontend (Vite, React, TS, Tailwind,
  Vitest).
- Vitest failed with `Invalid Chai property: toBeInTheDocument`. Cause: the shell's working
  directory used a lowercase drive letter (`d:\`), so Vitest loaded two module instances.
  Running from `D:\` fixed it; also switched tests to explicit `vitest` imports.
- Starter files (`LiveFeed.tsx`, `stream_client.py`, `sample_events.jsonl`) and the LLM key
  were not in the pack received; to be requested from the reviewers. Stream client and live feed
  wait for the starter files.
