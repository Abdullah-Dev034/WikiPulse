import asyncio
import logging
from collections import Counter, OrderedDict
from collections.abc import AsyncIterator, Callable
from datetime import datetime
from typing import Any

from app.ai.schemas import AIReview, PulseSummary
from app.models import EventFilter, RiskCategory, ScoredEvent
from app.processing.processor import EventProcessor
from app.processing.stats import build_stats, wiki_activity
from app.processing.store import EventStore
from app.processing.vandalism import VandalismScorer
from app.realtime.hub import Hub
from app.realtime.protocol import (
    AIReviewMessage,
    PulseMessage,
    Snapshot,
    StatsPayload,
    UpstreamState,
)

logger = logging.getLogger(__name__)

FEED_SIZE = 100
FLAGGED_SIZE = 20
MAX_PENDING_EVENTS = 500
MAX_AI_REVIEWS = 200
HUMANS = EventFilter(include_bots=False)


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
        self.pulse = PulseSummary(status="disabled")
        self.ai_reviews: OrderedDict[str, AIReview] = OrderedDict()
        # Called with every newly flagged edit (e.g. to queue an AI second opinion).
        self.on_flagged: Callable[[ScoredEvent], None] | None = None

    def snapshot(self, event_filter: EventFilter) -> Snapshot:
        payload = self.stats_payload(event_filter)
        flagged = self.store.latest(FLAGGED_SIZE, event_filter, flagged_only=True)
        return Snapshot(
            stats=payload.stats,
            wikis=payload.wikis,
            feed=self.store.latest(FEED_SIZE, event_filter),
            flagged=flagged,
            upstream=self.upstream,
            pulse=self.pulse,
            ai_reviews=[
                self.ai_reviews[item.event.id]
                for item in flagged
                if item.event.id in self.ai_reviews
            ],
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

    def set_pulse(self, summary: PulseSummary) -> None:
        self.pulse = summary
        self.hub.broadcast_message(PulseMessage(data=summary))

    def add_review(self, review: AIReview) -> None:
        self.ai_reviews[review.event_id] = review
        if len(self.ai_reviews) > MAX_AI_REVIEWS:
            self.ai_reviews.popitem(last=False)
        self.hub.broadcast_message(AIReviewMessage(data=review))

    def pulse_facts(self) -> tuple[dict[str, Any], datetime | None] | None:
        """Aggregates the AI pulse is allowed to see. None while the window is empty."""
        # Human edits, all wikis: matches the dashboard's default view (bots hidden), so the
        # summary's figures can be checked against the panels. One bot-inclusive total only.
        humans = build_stats(self.store, HUMANS)
        if humans.edits_last_5_minutes == 0:
            return None
        everything = build_stats(self.store)
        flagged = self.store.latest(len(self.store), HUMANS, flagged_only=True)
        reasons = Counter(signal.code for item in flagged for signal in item.risk.signals)
        facts = {
            "window_minutes": 5,
            "human_edits_last_minute": humans.edits_last_minute,
            "human_edits_last_5_minutes": humans.edits_last_5_minutes,
            "all_edits_last_5_minutes_including_bots": everything.edits_last_5_minutes,
            "wikis_with_human_edits": humans.active_wikis,
            "busiest_wikis_by_human_edits": [
                {"wiki": wiki.domain, "edits": wiki.edits}
                for wiki in wiki_activity(self.store, include_bots=False)[:5]
            ],
            "most_edited_pages_by_humans": [
                {"title": page.title, "wiki": page.domain, "edits": page.edits}
                for page in humans.top_pages[:5]
            ],
            "flagged_edits_last_5_minutes": humans.suspicious_last_5_minutes,
            "most_common_flag_reasons": [
                code.replace("_", " ") for code, _ in reasons.most_common(3)
            ],
        }
        return facts, humans.as_of

    async def ingest(self, source: AsyncIterator[str]) -> None:
        async for data in source:
            scored = self.processor.process_json(data)
            if scored is None:
                continue
            self._pending.append(scored)
            if len(self._pending) > MAX_PENDING_EVENTS:
                del self._pending[:-MAX_PENDING_EVENTS]
            if self.on_flagged and scored.risk.category is not RiskCategory.NORMAL:
                self.on_flagged(scored)

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
