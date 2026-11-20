from collections import deque
from datetime import datetime, timedelta

from app.models import ScoredEvent

DEFAULT_RETENTION = timedelta(minutes=5)


class EventStore:
    """Bounded, time-windowed store of recent events.

    Time is event time: "now" is the newest event timestamp seen (the watermark), so live
    data and replayed recordings behave the same. Queries filter by timestamp, so events
    that arrive slightly out of order are still counted in the right window. Eviction only
    exists to bound memory.

    Not thread-safe; it is used from a single asyncio event loop.
    """

    def __init__(self, retention: timedelta = DEFAULT_RETENTION, max_events: int = 50_000):
        self._retention = retention
        self._max_events = max_events
        self._events: deque[ScoredEvent] = deque()
        self._watermark: datetime | None = None

    @property
    def now(self) -> datetime | None:
        return self._watermark

    def __len__(self) -> int:
        return len(self._events)

    def accepts(self, timestamp: datetime) -> bool:
        """False for events too old to fall inside the retention window."""
        return self._watermark is None or timestamp > self._watermark - self._retention

    def add(self, item: ScoredEvent) -> bool:
        timestamp = item.event.timestamp
        if not self.accepts(timestamp):
            return False
        if self._watermark is None or timestamp > self._watermark:
            self._watermark = timestamp
        self._events.append(item)
        self._evict()
        return True

    def since(self, cutoff: datetime, domain: str | None = None) -> list[ScoredEvent]:
        """Events with timestamp strictly after cutoff, optionally for one wiki."""
        return [
            item
            for item in self._events
            if item.event.timestamp > cutoff and (domain is None or item.event.domain == domain)
        ]

    def latest(self, limit: int, domain: str | None = None) -> list[ScoredEvent]:
        """Most recently received events, newest first."""
        result: list[ScoredEvent] = []
        for item in reversed(self._events):
            if domain is None or item.event.domain == domain:
                result.append(item)
                if len(result) == limit:
                    break
        return result

    def _evict(self) -> None:
        assert self._watermark is not None
        cutoff = self._watermark - self._retention
        while self._events and (
            self._events[0].event.timestamp <= cutoff or len(self._events) > self._max_events
        ):
            self._events.popleft()
