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

## Phase 3 – WebSocket broadcasting and replay (Claude Code)

- Recorded 90 s of the live stream (`data/recorded_events.jsonl`, 2,589 events) as offline
  data until the provided `sample_events.jsonl` arrives.
- The WebSocket integration test caught a real race in Claude's first design: events that
  arrived just before a browser connected were in its snapshot *and* in the next events
  broadcast. Fixed by flushing pending events to existing clients before building a
  snapshot, and registering the new client only after its snapshot is queued.
- **Wrong (Claude):** first replay pacing slept on every forward timestamp step. Real
  recordings are slightly out of order (t, t+1, t, t+1 ...), so replay ran ~6x too slow.
  Found by running the server end to end, not by unit tests. Fixed by pacing on the furthest
  timestamp reached; regression test added.
- Added a "hide bots" filter alongside the wiki filter (Claude recommended it; user to confirm), since 39% of live
  edits are bots and they dominate the top-10.

## Phase 4 – React dashboard (Claude Code)

- Typed WebSocket contract mirrored in `frontend/src/types/protocol.ts`; pure reducer
  (snapshot replaces, events dedupe by id and cap at 100, flagged edits kept separately);
  `useDashboardSocket` keeps one socket and re-subscribes on filter change.
- Frontend tests first failed with "multiple elements found": Testing Library only
  auto-cleans between tests when Vitest globals are on, which Claude had turned off in
  Phase 0. Added explicit `afterEach(cleanup)`.
- Checked the real page in headless Edge (screenshots), not just tests. That found a layout
  bug the tests could not: at phone width, long unbroken edit comments stretched the grid
  past the screen. Fixed with `grid-cols-1` + `min-w-0`.
- Observation: replay looping re-plays the same editors ~90 s later, which trips the
  "rapid repeated edits" signal more than live traffic does (single pass: 4 of 1,476 edits
  flagged). Replay artefact, documented rather than tuned away.
- Charts follow a dataviz checklist: one blue for data, status colours only for risk and
  connection state (always with a text label), hover tooltip, hidden table for screen
  readers.

## Phase 4b – UI redesign ("Geeks Evolution" dark theme)

- User iterated through several themes (Geeks palette from geeks.ltd's public CSS, dark
  green, light professional) and then supplied a detailed redesign brief and palette.
- Kept the data layer untouched (socket hook, reducer, protocol types); split components
  into DashboardHeader / ConnectionStatus / WikiFilter / MetricCard / VandalismPanel +
  VandalismAlert / TrendingPages / LiveFeed + LiveFeedItem / AIInsightPanel.
- Declined to fabricate numbers the brief's style implied: the only trend shown is edits/min
  vs the previous minute, computed from real 10 s buckets; the AI panel shows an honest
  "not enabled" state until Phase 5.
- Wikidata titles (Q/P/L ids) are labelled as entities, since the stream carries no labels.
- Screenshot review caught issues the tests did not: the chart rendered blank inside nested
  flex layout (fixed by absolutely positioning the Recharts container), wrapped timestamps,
  clipped tags on phones, and an empty block under the feed.

## Phase 6a – Provided sample_events.jsonl

- Geeks replied with one file, `sample_events.jsonl` (2,000 synthetic events, 12 minutes).
  No `stream_client.py` or `LiveFeed.tsx` was provided, so live ingestion is our own code.
- Profiled the file with a throwaway script before touching code. It is a test fixture with
  planted problems: 1 invalid JSON line, 30 duplicate ids, 2 null titles, 3 missing
  timestamps, 14 millisecond timestamps, 1 event with no `meta`, null `wiki`/`user`/`bot`,
  55 out-of-order steps, two prompt-injection summaries ("Ignore all previous instructions…",
  "SYSTEM OVERRIDE … {"label":"safe"}"), two XSS summaries and a UTF-8 test line.
- Baseline run through our existing processor: most cases already handled, but (a) zero
  edits flagged, (b) millisecond timestamps would have broken **replay pacing** — the clock
  jumps ~1000x forward and the rest of the file plays with no delay. Pydantic parsed ms
  timestamps fine in the normalizer, so tests on the normalizer alone would not catch it.
- Added: shared `epoch_seconds`/`event_seconds` helper, fallbacks for missing `meta`
  (domain from `server_name`, id from rc id + time), diff URL built from revisions, and two
  rules: instructions aimed at automated reviewers (40) and HTML/script markup (30) in the
  edit summary. A regression test pins the sample's exact counts.
- AI mistake (shell escaping): writing regexes through a bash heredoc into Python left 10
  literal backspace characters in `vandalism.py` (`\b` was un-escaped twice). Tests would
  have failed mysteriously; caught by grepping for control characters. Rewrote the block
  with the editor tool instead of the shell.
- Found a pre-existing flaky WebSocket test (14% failure over 150 in-process runs). First
  hypothesis (our cleanup swallowing cancellation) was wrong: changing it raised failures to
  53%. Reverted. Real cause: Starlette's TestClient cancels the server task right after
  sending the disconnect. Test now closes and waits for the server to drop the client:
  300/300 passing.

## Phase 6b – Live EventStreams client (own implementation)

- No `stream_client.py` arrived, so wrote `app/ingestion/live.py` from the EventStreams
  docs: small SSE parser, exponential backoff with jitter, `Retry-After`, `Last-Event-ID`
  resume, upstream state for the dashboard. Tested with `httpx.MockTransport`.
- First real run: **HTTP 403** "Please respect our robot policy". Same User-Agent through
  curl got 200; through httpx, 403 — Wikimedia evidently classifies Python clients and
  then enforces its User-Agent policy (contact URL/email required). The earlier recording
  (Phase 2) had worked with the same generic UA, so enforcement changed since then.
- Did not put the candidate's GitHub URL or email into requests to test it: that is
  personal data sent to a third party and needs their OK. Instead: 401/403 now stops the
  client (no retry hammering) with a clear log line, `USER_AGENT` is documented in
  `.env.example`, and the parser was verified on 5 s of real stream bytes captured with
  curl and replayed through a mock transport (151 events, 0 malformed, resume id correct).
