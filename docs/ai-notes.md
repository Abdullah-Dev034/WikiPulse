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

## Phase 2 – processing, rolling stats, risk scoring (Claude Code)

- Checked the real event shape against the live stream before writing the model (did not
  rely on the AI's memory of the schema). Found logged-out editors now appear as temporary
  accounts (`~2026-55293-33`), not IPs; the "unregistered editor" rule handles both.
- **Wrong (Claude):** wrote a stats test expecting an edit at exactly t-10s in the newest
  10-second bucket. With half-open windows `(start, end]` it belongs to the previous bucket;
  the code was right and the test expectation was corrected.
- Regression test added for ChatGPT's `old_length == 0` bug (page creations still scored).
- Live check, 60 s of real stream: ~930 edits/min, 63 wikis, 39% bot edits, 35% Wikidata.
  1 of 932 edits flagged (needs review). Top pages are dominated by Wikidata Q-ids, which
  matters for the dashboard's default view (decision pending).
