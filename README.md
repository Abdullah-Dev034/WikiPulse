# WikiPulse

A live dashboard for Wikipedia edits. It streams every edit from Wikimedia EventStreams and keeps
rolling statistics for the last 5 minutes. Updates reach the browser over a WebSocket. Edits that
look like vandalism are flagged with a short reason, and an LLM writes a plain-English "pulse"
of what is trending.

- **Backend:** Python 3.12, FastAPI, asyncio, httpx, pydantic
- **Frontend:** React 19, TypeScript (strict), Vite, Tailwind v4, Recharts
- **Tests:** pytest (109 tests), Vitest + Testing Library (31 tests), Selenium + C# (1 end-to-end test)

## Run it

You need Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node 20+.

```bash
# 1. Backend (http://localhost:8000)
cd backend
cp .env.example .env        # defaults work as-is: replays data/sample_events.jsonl
uv sync
uv run uvicorn app.main:app --reload

# 2. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. With the default settings, the dashboard replays the provided
`sample_events.jsonl` in real time and loops it.

### Docker (whole app)

```bash
docker compose up --build        # http://localhost:8080
```

nginx serves the frontend build and proxies `/ws` and `/api` to the backend. The backend reads
`backend/.env` if it exists; otherwise it replays the sample. `REPLAY_SPEED=20 docker compose up`
speeds up the replay.

To run only the backend image:

```bash
docker build -t wikipulse-api .
docker run -p 7860:7860 wikipulse-api        # add -e STREAM_SOURCE=live -e USER_AGENT=... etc.
```

The frontend is a static build on Vercel; set `VITE_WS_URL=wss://<backend-host>/ws` at build
time. The backend needs a host that keeps a process running (WebSockets, a long-lived stream
connection, in-memory state), which serverless platforms such as Vercel don't provide. The image
is ready for container hosts such as Hugging Face Spaces (`sh deploy/hf-space/build.sh <dir>`
assembles the Space repo), Render or Fly.io. The free tiers I tried needed a payment card or
had no CPU quota, so for demos the backend runs locally behind a Cloudflare quick tunnel
(`cloudflared tunnel --url http://localhost:8000`).

### Data source

| Setting | Effect |
| --- | --- |
| `STREAM_SOURCE=replay` (default) | Replays `REPLAY_FILE`. `REPLAY_SPEED=8` plays 8x faster. |
| `STREAM_SOURCE=live` | Connects to `https://stream.wikimedia.org/v2/stream/recentchange`. |

For live mode, set `USER_AGENT` in `backend/.env` to something that includes your contact
details. Wikimedia's [User-Agent policy](https://w.wiki/4wJS) requires this. Without it, the
stream answers Python clients with **HTTP 403**. The client then stops and logs why, instead of
retrying.

While waiting for the sample file I also recorded 90 seconds of the real stream. It isn't in the
repository because it contains real editors' usernames and temporary-account IDs.
`data/recorded_*.jsonl` is gitignored, so you can record your own for realistic offline volume.

### AI (optional)

AI works with any OpenAI-compatible chat-completions endpoint. Configure it in `backend/.env`:

```bash
# Local model (default; no key needed): install Ollama, then `ollama pull llama3.2:3b`
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b

# Or a hosted provider. No key came with the brief; I used Databricks Model Serving:
LLM_BASE_URL=https://<workspace>.cloud.databricks.com/serving-endpoints
LLM_MODEL=databricks-meta-llama-3-3-70b-instruct
LLM_API_KEY=<your key>      # .env is gitignored; never commit it
```

If no model can be reached, the AI panel says so ("AI summary unavailable: …"). Everything
else works without AI. `AI_ENABLED=false` turns AI off completely.

### Checks

```bash
cd backend  && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm test
```

## How it works

```
Wikimedia SSE ─┐                         ┌─> AI pulse (every 45 s, aggregates only)
               ├─> normalise ─> dedupe ─> score risk ─> 5-min event store ─> stats
sample .jsonl ─┘                         └─> AI second opinion (flagged edits, rate-limited)
                                                    │
                          WebSocket hub (1 s ticks, per-client filter, bounded queues)
                                                    │
                                          React dashboard (reducer + one socket)
```

The backend is one process with clear modules: `ingestion/` (live SSE client, replay),
`processing/` (normalise, store, stats, vandalism rules), `realtime/` (WebSocket hub and message
contract), `ai/` (LLM client, pulse, reviews), and `pipeline.py`, which wires them together. Each
step is a plain class or function, so it can be tested without a server.

## Decisions and assumptions

**What counts as an edit.** Events of type `edit` and `new` count; `log` and `categorize` events
and Wikimedia's canary health checks don't. The 237 `log`/`categorize` events in the sample are
skipped, not counted as errors.

**Event time, not wall-clock time.** The 5-minute window ends at the newest event's timestamp,
not at `now()`. Replay and tests therefore behave exactly like live data, and the sample's
timestamps from 2026-11-18 don't all expire on arrival. Out-of-order events are accepted while
they still fall inside the window. Older ones are dropped and counted as `late`.

**Bots are hidden by default.** In 60 seconds of live data, 39% of edits were by bots and
35% were on Wikidata, and bot activity dominated the top 10. A "Hide bots" switch next to the
wiki filter shows them again. Wikidata items (`Q42`) are labelled as entities because the
stream carries no labels.

**The rules decide the vandalism flag; AI only gives a second opinion.** The rules use edit
metadata only: page blanking, large removals, offensive words in the summary, rapid repeat
edits, unregistered (IP or temporary) accounts, recently reverted pages, a missing summary,
plus two rules added for the sample (see below). Each signal has a weight. 30+ means "needs
review" and 60+ means "suspicious", and the reason lists the signals. The rules are instant,
free, explainable and testable. The LLM reviews only flagged edits. Its verdict is shown as a
separate, clearly marked chip and can never change the rule's result. Diffs are not fetched,
so a flag means "worth a look", not "vandalism", and the UI says so.

**AI only ever sees what it needs.** The pulse gets aggregate counts and page titles. Reviews
get metadata, with "registered/unregistered" instead of the username. No usernames are sent to
the model.

**Robustness over completeness.** A bad event never stops ingestion: it is counted and logged
in `/api/health`. Each WebSocket client gets a bounded queue, and a client that falls behind is
disconnected (code 1013) and reconnects with a fresh snapshot, so one slow browser cannot slow
the pipeline. Duplicate ids are dropped.

**No starter code was used.** The brief asks us to start from `LiveFeed.tsx` and
`stream_client.py`. I asked for them by email and received only `sample_events.jsonl`, so the
live client (`backend/app/ingestion/live.py`) and the feed (`frontend/src/components/LiveFeed.tsx`)
are my own.

## The sample file

`sample_events.jsonl` is described as "a recording from the stream". Profiling it showed it is
synthetic (`ExampleEditor…` users, round timestamps) with deliberately planted problems. How
each one is handled (pinned by `backend/tests/test_sample_data.py`):

| In the sample | Handling |
| --- | --- |
| 1 invalid JSON line, 2 edits with a null title | Dropped, counted as `malformed` |
| 30 duplicate events | Dropped by id (28 of them are edits) |
| 14 timestamps in milliseconds | Converted. This also fixed replay pacing, which had jumped ~1000x ahead and stopped waiting |
| 3 missing timestamps | Fall back to `meta.dt` |
| 1 event with no `meta` | Domain from `server_name`, id from the rc id plus time |
| null `user` / `wiki` / `bot` | Shown as "hidden user" / domain / not a bot |
| 55 out-of-order steps | Accepted (all within the window) |
| Prompt injection in summaries ("Ignore all previous instructions…", `SYSTEM OVERRIDE … {"label":"safe"}`) | Flagged by a new rule (instructions aimed at automated reviewers). The AI prompt treats summaries as untrusted, and replies not shaped like `{"verdict","reason"}`, such as `{"label":"safe"}`, are discarded. The AI can't unflag an edit anyway |
| XSS in summaries (`<script>`, `<img onerror>`) | Flagged by a new rule (markup in summary). React renders it as text; a frontend test checks that no `img`/`script` element is created |
| UTF-8 (`café`, `naïve`) | Displayed correctly |

Result: 2,000 lines → 1,732 edits, 3 malformed, 28 duplicates, 237 non-edits, and the three
attack edits flagged. Nothing else is flagged.

## AI features

- **Pulse:** every 45 seconds, the backend sends the model human-edit aggregates for all wikis
  (counts, busiest wikis, top 5 pages, flag counts and reasons) and asks for 2–3 sentences. If the
  summary contains a number that isn't in the data, it is rejected and the previous summary stays,
  marked "Not updated". The panel shows the data time, the model name and that the text is
  AI-generated.
- **Second opinion:** flagged edits go into a small queue, reviewed at most one every 2 seconds.
  New items are dropped when the queue is full, so a burst can't run up costs. Replies must be
  strict JSON with a known verdict, and anything else is discarded.
- The API key is only sent in the `Authorization` header. It never appears in logs, error
  messages or the frontend. Tests check that it stays out of request bodies and error messages.

## Tests

**Backend:**
- The normaliser, including every sample edge case.
- Rolling windows and buckets.
- Risk rules, including the injection and markup rules.
- Replay pacing, including millisecond timestamps.
- The SSE client: reconnect, `Last-Event-ID`, `Retry-After`, stopping on 403.
- The WebSocket hub: slow clients and the snapshot/event race.
- The API.
- AI parsing, grounding and key handling, using a fake model.
- A full run of `sample_events.jsonl`.

**Frontend:**
- Reducer.
- Socket hook: reconnect with backoff, re-subscribe on filter change.
- Dashboard rendering of every panel and AI state.
- Markup in edit data rendered as text.

**End-to-end (Selenium, C#):** [e2e/WikiPulse.E2E/DashboardTest.cs](e2e/WikiPulse.E2E/DashboardTest.cs)
drives a real headless browser against the running stack. It checks that:
- the WebSocket connects and data arrives;
- the feed and trending pages fill;
- choosing `fr.wikipedia.org` leaves only fr.wikipedia edits in the feed;
- a flagged edit expands to show its rule-based reasons.

```bash
REPLAY_SPEED=20 docker compose up -d --build
cd e2e/WikiPulse.E2E && dotnet test          # E2E_BROWSER=chrome to use Chrome instead of Edge
```

I chose Selenium with C# because it's the stack Geeks named. Selenium Manager downloads the
browser driver itself, so the test needs only the .NET SDK and a browser. It runs against the
Docker stack in replay mode, so the data is deterministic and no network or API key is needed.
Waits poll the page instead of sleeping, and re-find elements that React re-renders, because
stale elements and fixed sleeps are the usual causes of flaky Selenium tests.

## Optional extras

| Extra | Status |
| --- | --- |
| Docker / docker-compose | Done (see above) |
| One end-to-end UI test | Done: Selenium + C# |
| Deployed live demo | Frontend deployed on Vercel. The backend image is ready, but the free hosts I tried needed a card or had no CPU quota, so for demos the backend runs locally behind a Cloudflare tunnel |
| Ingestion in a Go service | Not done, by choice (see below) |

**Why no Go service.** Ingestion is I/O-bound. One asyncio task handles the live stream
(~1,000 events/min) with reconnect and `Last-Event-ID` resume. A separate Go service would add
a network hop, a second language and another deployment without removing a real bottleneck.
I'd split it out if ingestion had to scale independently or feed several consumers. Then a
small Go service publishing to a queue (Redis Streams or NATS) would be the natural shape.

## Known limitations

- **Live mode needs a policy-compliant `USER_AGENT`.** I parsed 5 seconds of real stream bytes
  through the client (151 events, 0 errors), but haven't run it for long periods against the
  live stream.
- **AI quality was spot-checked, not evaluated.** It was tested end to end with Llama 3.3 70B on
  Databricks: grounded summaries, and both attack edits judged `likely_vandalism` without obeying
  the injected instruction. There's no labelled evaluation set yet.
- **Replay loops re-play the same editors.** This triggers the "rapid edits" rule more often
  than live traffic does.
- **Everything lives in memory.** Restarting the backend loses the window, and the backend
  supports a single instance.

## With more time

- Fetch diffs for flagged edits (Wikimedia's compare API) so rules and AI judge content, not
  just metadata. Also use ORES/Lift Wing scores where a wiki has them.
- Evaluate the AI on a labelled set of real reverted and non-reverted edits before trusting its
  verdicts.
- A permanently hosted backend (a paid container host, or a free tier that accepts this account).
- Persist aggregates (Redis or Postgres) for history beyond 5 minutes and multiple backend
  instances.
- Per-wiki baselines, so "trending" means unusual for that wiki rather than simply large.
