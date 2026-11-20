import asyncio
import logging
from collections.abc import AsyncIterator

from app.models import EventFilter, ScoredEvent
from app.processing.processor import EventProcessor
from app.processing.stats import build_stats, wiki_activity
from app.processing.store import EventStore
from app.processing.vandalism import VandalismScorer
from app.realtime.hub import Hub
from app.realtime.protocol import Snapshot, StatsPayload, UpstreamState

logger = logging.getLogger(__name__)

FEED_SIZE = 100
FLAGGED_SIZE = 20
MAX_PENDING_EVENTS = 500


class Pipeline:
    """Owns the in-memory state and connects ingestion, processing and broadcasting.

    Everything runs on one asyncio event loop, so the store is never touched concurrently.
    """

    def __init__(self) -> None:
        self.store = EventStore()
        self.processor = EventProcessor(self.store, VandalismScorer())
        self.hub = Hub(self.consistent_snapshot)
        self.upstream: UpstreamState = "connecting"
        self._pending: list[ScoredEvent] = []

    def snapshot(self, event_filter: EventFilter) -> Snapshot:
        payload = self.stats_payload(event_filter)
        return Snapshot(
            stats=payload.stats,
            wikis=payload.wikis,
            feed=self.store.latest(FEED_SIZE, event_filter),
            flagged=self.store.latest(FLAGGED_SIZE, event_filter, flagged_only=True),
            upstream=self.upstream,
        )

    def consistent_snapshot(self, event_filter: EventFilter) -> Snapshot:
        """Snapshot for a WebSocket client. Pending events are flushed to existing clients
        first, so a snapshot and the event stream that follows it never overlap."""
        self.flush()
        return self.snapshot(event_filter)

    def stats_payload(self, event_filter: EventFilter) -> StatsPayload:
        return StatsPayload(
            stats=build_stats(self.store, event_filter),
            wikis=wiki_activity(self.store, event_filter.include_bots),
        )

    def set_upstream(self, state: UpstreamState) -> None:
        if state != self.upstream:
            self.upstream = state
            self.hub.broadcast_status(state)

    async def ingest(self, source: AsyncIterator[str]) -> None:
        async for data in source:
            scored = self.processor.process_json(data)
            if scored is not None:
                self._pending.append(scored)
                if len(self._pending) > MAX_PENDING_EVENTS:
                    del self._pending[:-MAX_PENDING_EVENTS]

    def flush(self) -> None:
        """Send events received since the last flush plus fresh stats to every client."""
        events, self._pending = self._pending, []
        self.hub.broadcast(events, self.stats_payload)

    async def run_broadcaster(self, interval_seconds: float) -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                self.flush()
            except Exception:
                logger.exception("Broadcast failed; will retry on the next tick")
