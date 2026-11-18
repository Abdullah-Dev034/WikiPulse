import json
import logging
from collections import deque
from dataclasses import dataclass

from app.models import ScoredEvent
from app.processing.normalize import MalformedEventError, normalize_event
from app.processing.store import EventStore
from app.processing.vandalism import VandalismScorer

logger = logging.getLogger(__name__)


@dataclass
class ProcessorCounters:
    received: int = 0
    accepted: int = 0
    skipped: int = 0
    duplicates: int = 0
    malformed: int = 0
    late: int = 0


class RecentIds:
    """Bounded set of recently seen ids: remembers the last `capacity` ids."""

    def __init__(self, capacity: int):
        self._order: deque[str] = deque()
        self._ids: set[str] = set()
        self._capacity = capacity

    def add(self, event_id: str) -> bool:
        """Record the id. Returns False if it was already seen."""
        if event_id in self._ids:
            return False
        self._ids.add(event_id)
        self._order.append(event_id)
        if len(self._order) > self._capacity:
            self._ids.discard(self._order.popleft())
        return True


class EventProcessor:
    """Turns raw stream payloads into scored events and stores them.

    Pipeline: parse -> normalise -> drop non-edits -> dedupe -> drop late -> score -> store.
    Bad input is counted and logged, never raised, so one bad event cannot stop ingestion.
    """

    def __init__(self, store: EventStore, scorer: VandalismScorer, dedup_capacity: int = 50_000):
        self._store = store
        self._scorer = scorer
        self._seen = RecentIds(dedup_capacity)
        self.counters = ProcessorCounters()

    def process_json(self, data: str) -> ScoredEvent | None:
        try:
            raw = json.loads(data)
        except json.JSONDecodeError as exc:
            self.counters.received += 1
            self.counters.malformed += 1
            logger.warning("Dropping event with invalid JSON: %s", exc)
            return None
        return self.process(raw)

    def process(self, raw: object) -> ScoredEvent | None:
        self.counters.received += 1
        try:
            event = normalize_event(raw)
        except MalformedEventError as exc:
            self.counters.malformed += 1
            logger.warning("Dropping malformed event: %s", exc)
            return None
        if event is None:
            self.counters.skipped += 1
            return None
        if not self._store.accepts(event.timestamp):
            self.counters.late += 1
            return None
        if not self._seen.add(event.id):
            self.counters.duplicates += 1
            return None

        scored = ScoredEvent(event=event, risk=self._scorer.assess(event))
        self._store.add(scored)
        self.counters.accepted += 1
        return scored
