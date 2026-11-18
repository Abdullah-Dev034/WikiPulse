import asyncio
import contextlib
import logging
from collections.abc import Callable

from fastapi import WebSocket
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from app.models import EventFilter, ScoredEvent
from app.realtime.protocol import (
    EventsMessage,
    Snapshot,
    SnapshotMessage,
    StatsMessage,
    StatsPayload,
    StatusMessage,
    SubscribeMessage,
    UpstreamState,
    UpstreamStatus,
)

logger = logging.getLogger(__name__)

# 1013 "Try Again Later": the client fell too far behind; it reconnects and gets a snapshot.
CLOSE_TOO_SLOW = 1013
MAX_EVENTS_PER_MESSAGE = 50


class ClientConnection:
    """One browser connection with its own bounded outbound queue."""

    def __init__(self, websocket: WebSocket, max_queue: int):
        self.websocket = websocket
        self.filter = EventFilter()
        self.too_slow = asyncio.Event()
        self._queue: asyncio.Queue[str] = asyncio.Queue(max_queue)

    def offer(self, message: str) -> None:
        """Queue a message without waiting. A full queue marks the client as too slow."""
        if self.too_slow.is_set():
            return
        try:
            self._queue.put_nowait(message)
        except asyncio.QueueFull:
            self.too_slow.set()

    async def pump(self) -> None:
        while True:
            await self.websocket.send_text(await self._queue.get())


class Hub:
    """Fans processed events and statistics out to connected dashboards.

    Ingestion calls broadcast() synchronously; it only enqueues, so a slow or dead browser
    can never block the pipeline. Each distinct filter is serialised once per broadcast.
    """

    def __init__(self, snapshot: Callable[[EventFilter], Snapshot], max_queue: int = 64):
        self._snapshot = snapshot
        self._max_queue = max_queue
        self._clients: set[ClientConnection] = set()

    @property
    def client_count(self) -> int:
        return len(self._clients)

    async def serve(self, websocket: WebSocket) -> None:
        await websocket.accept()
        client = ClientConnection(websocket, self._max_queue)
        self._send_snapshot(client)
        self._clients.add(client)
        tasks = {
            asyncio.create_task(client.pump()),
            asyncio.create_task(self._receive(client)),
            asyncio.create_task(client.too_slow.wait()),
        }
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            self._clients.discard(client)
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            if client.too_slow.is_set():
                logger.warning("Disconnecting a client that fell behind")
                await _close_quietly(websocket, CLOSE_TOO_SLOW)

    def broadcast(
        self,
        events: list[ScoredEvent],
        stats_payload: Callable[[EventFilter], StatsPayload],
    ) -> None:
        messages: dict[EventFilter, list[str]] = {}
        for client in list(self._clients):
            if client.filter not in messages:
                messages[client.filter] = self._render(client.filter, events, stats_payload)
            for message in messages[client.filter]:
                client.offer(message)

    def broadcast_status(self, state: UpstreamState) -> None:
        message = StatusMessage(data=UpstreamStatus(state=state)).model_dump_json()
        for client in list(self._clients):
            client.offer(message)

    def _render(
        self,
        event_filter: EventFilter,
        events: list[ScoredEvent],
        stats_payload: Callable[[EventFilter], StatsPayload],
    ) -> list[str]:
        matching = [item for item in events if event_filter.matches(item.event)]
        rendered = []
        if matching:
            newest = matching[-MAX_EVENTS_PER_MESSAGE:]
            rendered.append(EventsMessage(data=newest).model_dump_json())
        rendered.append(StatsMessage(data=stats_payload(event_filter)).model_dump_json())
        return rendered

    async def _receive(self, client: ClientConnection) -> None:
        try:
            async for text in client.websocket.iter_text():
                try:
                    message = SubscribeMessage.model_validate_json(text)
                except ValidationError:
                    logger.info("Ignoring unknown client message")
                    continue
                client.filter = message.to_filter()
                self._send_snapshot(client)
        except WebSocketDisconnect:
            return

    def _send_snapshot(self, client: ClientConnection) -> None:
        client.offer(SnapshotMessage(data=self._snapshot(client.filter)).model_dump_json())


async def _close_quietly(websocket: WebSocket, code: int) -> None:
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.close(code=code)
