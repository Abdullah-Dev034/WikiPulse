"""Client for the Wikimedia EventStreams recentchange feed (Server-Sent Events).

Written for WikiPulse: the brief offered a stream_client.py starter, but only
sample_events.jsonl was provided, so this follows the EventStreams docs directly.
"""

import asyncio
import logging
import random
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field

import httpx

from app.realtime.protocol import UpstreamState

logger = logging.getLogger(__name__)

INITIAL_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 30.0
# Wikimedia sends a comment heartbeat well inside this; silence means a dead connection.
READ_TIMEOUT_SECONDS = 60.0
# Not worth retrying: the client itself is refused (e.g. User-Agent policy).
BLOCKED_STATUSES = frozenset({401, 403})


class UpstreamError(Exception):
    """The stream answered with something other than an event stream."""

    def __init__(self, status_code: int, retry_after: float | None = None):
        super().__init__(f"upstream returned HTTP {status_code}")
        self.status_code = status_code
        self.retry_after = retry_after


@dataclass
class ServerSentEvent:
    event: str = "message"
    data: list[str] = field(default_factory=list)
    id: str | None = None


async def parse_sse(lines: AsyncIterator[str]) -> AsyncIterator[ServerSentEvent]:
    """Minimal SSE parser (WHATWG spec): `field: value` lines, blank line dispatches."""
    current = ServerSentEvent()
    async for line in lines:
        if not line:
            if current.data:
                yield current
            current = ServerSentEvent()
            continue
        if line.startswith(":"):
            continue  # comment / heartbeat
        name, _, value = line.partition(":")
        value = value.removeprefix(" ")
        if name == "data":
            current.data.append(value)
        elif name == "event":
            current.event = value
        elif name == "id" and "\0" not in value:
            current.id = value
    if current.data:
        yield current


def backoff_seconds(attempt: int) -> float:
    """Exponential backoff with full jitter: attempt 1 -> up to 1 s, capped at 30 s."""
    ceiling = min(MAX_BACKOFF_SECONDS, INITIAL_BACKOFF_SECONDS * 2 ** (attempt - 1))
    return random.uniform(ceiling / 2, ceiling)


async def live_events(
    url: str,
    user_agent: str,
    on_state: Callable[[UpstreamState], None],
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[str]:
    """Yield the JSON payload of every recentchange event, reconnecting forever.

    Reconnects resume from the last event id (Last-Event-ID), so a dropped connection
    loses no events while Wikimedia still holds them.
    """
    last_event_id: str | None = None
    attempt = 0
    timeout = httpx.Timeout(10.0, read=READ_TIMEOUT_SECONDS)
    headers = {"User-Agent": user_agent, "Accept": "text/event-stream"}
    on_state("connecting")
    async with httpx.AsyncClient(timeout=timeout, headers=headers, transport=transport) as client:
        while True:
            retry_after: float | None = None
            try:
                async for sse in _connect(client, url, last_event_id, on_state):
                    attempt = 0
                    last_event_id = sse.id or last_event_id
                    if sse.event == "message":
                        yield "\n".join(sse.data)
                logger.info("Upstream closed the stream; reconnecting")
            except UpstreamError as exc:
                if exc.status_code in BLOCKED_STATUSES:
                    # Retrying a policy block is exactly the traffic Wikimedia asks bots to avoid.
                    logger.error(
                        "Stream refused this client (%s). Wikimedia requires a User-Agent with "
                        "contact details: set USER_AGENT in backend/.env (see .env.example).",
                        exc,
                    )
                    on_state("stopped")
                    return
                logger.warning("Stream rejected the connection: %s", exc)
                retry_after = exc.retry_after
            except httpx.HTTPError as exc:
                logger.warning("Stream connection failed: %s", exc.__class__.__name__)

            attempt += 1
            on_state("reconnecting")
            await asyncio.sleep(max(retry_after or 0.0, backoff_seconds(attempt)))


async def _connect(
    client: httpx.AsyncClient,
    url: str,
    last_event_id: str | None,
    on_state: Callable[[UpstreamState], None],
) -> AsyncIterator[ServerSentEvent]:
    """One connection: the events it delivers until it closes or fails."""
    headers = {"Last-Event-ID": last_event_id} if last_event_id else {}
    async with client.stream("GET", url, headers=headers) as response:
        if response.status_code != httpx.codes.OK:
            raise UpstreamError(response.status_code, _retry_after(response))
        on_state("live")
        async for sse in parse_sse(response.aiter_lines()):
            yield sse


def _retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("Retry-After", "")
    return min(float(value), 300.0) if value.isdigit() else None
