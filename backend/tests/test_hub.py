import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any, cast

from fastapi import WebSocket

from app.models import EventFilter
from app.processing.stats import build_stats
from app.processing.store import EventStore
from app.realtime.hub import CLOSE_TOO_SLOW, Hub
from app.realtime.protocol import Snapshot, StatsPayload
from tests.factories import scored


class FakeWebSocket:
    """Just enough of Starlette's WebSocket for the hub."""

    def __init__(self, incoming: list[str] | None = None, block_sends: bool = False):
        self.sent: list[dict[str, Any]] = []
        self.closed_with: int | None = None
        self._incoming = incoming or []
        self._block_sends = block_sends

    async def accept(self) -> None:
        return None

    async def send_text(self, data: str) -> None:
        if self._block_sends:
            await asyncio.Event().wait()
        self.sent.append(json.loads(data))

    async def iter_text(self) -> AsyncIterator[str]:
        for message in self._incoming:
            yield message
        await asyncio.Event().wait()

    async def close(self, code: int) -> None:
        self.closed_with = code

    def of_type(self, message_type: str) -> list[dict[str, Any]]:
        return [message for message in self.sent if message["type"] == message_type]


def empty_snapshot(event_filter: EventFilter) -> Snapshot:
    return Snapshot(
        stats=build_stats(EventStore(), event_filter),
        wikis=[],
        feed=[],
        flagged=[],
        upstream="replay",
    )


def no_stats(event_filter: EventFilter) -> StatsPayload:
    return StatsPayload(stats=build_stats(EventStore(), event_filter), wikis=[])


async def settle() -> None:
    for _ in range(5):
        await asyncio.sleep(0)


async def test_each_client_only_receives_events_matching_its_filter() -> None:
    hub = Hub(empty_snapshot)
    everything = FakeWebSocket()
    german = FakeWebSocket(incoming=['{"type": "subscribe", "wiki": "de.wikipedia.org"}'])
    serving = [asyncio.create_task(hub.serve(cast(WebSocket, ws))) for ws in (everything, german)]
    await settle()

    hub.broadcast([scored(domain="en.wikipedia.org"), scored(domain="de.wikipedia.org")], no_stats)
    await settle()

    assert len(everything.of_type("events")[0]["data"]) == 2
    german_events = german.of_type("events")[0]["data"]
    assert [item["event"]["domain"] for item in german_events] == ["de.wikipedia.org"]
    assert german.of_type("snapshot")[-1]["data"]["stats"]["filter"]["wiki"] == "de.wikipedia.org"
    for task in serving:
        task.cancel()


async def test_unknown_client_messages_are_ignored() -> None:
    hub = Hub(empty_snapshot)
    ws = FakeWebSocket(incoming=["not json", '{"type": "unknown"}'])
    task = asyncio.create_task(hub.serve(cast(WebSocket, ws)))
    await settle()

    assert hub.client_count == 1
    assert len(ws.of_type("snapshot")) == 1
    task.cancel()


async def test_slow_client_is_disconnected_without_blocking_broadcast() -> None:
    hub = Hub(empty_snapshot, max_queue=2)
    slow = FakeWebSocket(block_sends=True)
    serving = asyncio.create_task(hub.serve(cast(WebSocket, slow)))
    await settle()

    for _ in range(5):
        hub.broadcast([scored()], no_stats)  # returns immediately even though sends block
    await asyncio.wait_for(serving, timeout=1)

    assert slow.closed_with == CLOSE_TOO_SLOW
    assert hub.client_count == 0


async def test_disconnected_client_is_removed() -> None:
    hub = Hub(empty_snapshot)
    ws = FakeWebSocket()

    async def closed_immediately() -> AsyncIterator[str]:
        return
        yield

    ws.iter_text = closed_immediately  # type: ignore[method-assign]
    await asyncio.wait_for(hub.serve(cast(WebSocket, ws)), timeout=1)

    assert hub.client_count == 0
