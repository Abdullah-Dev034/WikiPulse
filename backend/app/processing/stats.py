from collections import Counter
from datetime import timedelta

from app.models import (
    ActivityPoint,
    DashboardStats,
    EventFilter,
    PageCount,
    RiskCategory,
    WikiCount,
)
from app.processing.store import ALL_EVENTS, EventStore

MINUTE = timedelta(minutes=1)
TRENDING_WINDOW = timedelta(minutes=5)
ACTIVITY_BUCKET = timedelta(seconds=10)
TOP_PAGES = 10


def build_stats(store: EventStore, event_filter: EventFilter = ALL_EVENTS) -> DashboardStats:
    """Rolling statistics at the store's current event time for the events the filter matches.

    Windows are half-open: (now - span, now].
    """
    now = store.now
    if now is None:
        return DashboardStats(
            as_of=None,
            filter=event_filter,
            edits_last_minute=0,
            edits_last_5_minutes=0,
            active_wikis=0,
            suspicious_last_5_minutes=0,
            top_pages=[],
            activity=[],
        )

    recent = store.since(now - TRENDING_WINDOW, event_filter)
    minute_cutoff = now - MINUTE
    pages = Counter((item.event.domain, item.event.title) for item in recent)
    top = sorted(pages.items(), key=lambda entry: (-entry[1], entry[0]))[:TOP_PAGES]

    bucket_count = int(TRENDING_WINDOW / ACTIVITY_BUCKET)
    buckets = [0] * bucket_count
    for item in recent:
        age = now - item.event.timestamp
        buckets[bucket_count - 1 - int(age / ACTIVITY_BUCKET)] += 1
    window_start = now - TRENDING_WINDOW

    return DashboardStats(
        as_of=now,
        filter=event_filter,
        edits_last_minute=sum(1 for item in recent if item.event.timestamp > minute_cutoff),
        edits_last_5_minutes=len(recent),
        active_wikis=len({item.event.domain for item in recent}),
        suspicious_last_5_minutes=sum(
            1 for item in recent if item.risk.category is not RiskCategory.NORMAL
        ),
        top_pages=[
            PageCount(domain=page_domain, title=title, edits=edits)
            for (page_domain, title), edits in top
        ],
        activity=[
            ActivityPoint(end=window_start + ACTIVITY_BUCKET * (index + 1), edits=edits)
            for index, edits in enumerate(buckets)
        ],
    )


def wiki_activity(store: EventStore, include_bots: bool = True) -> list[WikiCount]:
    """Edits per wiki in the trending window, busiest first. Used to populate the filter."""
    if store.now is None:
        return []
    recent = store.since(store.now - TRENDING_WINDOW, EventFilter(include_bots=include_bots))
    counts = Counter(item.event.domain for item in recent)
    return [
        WikiCount(domain=domain, edits=edits)
        for domain, edits in sorted(counts.items(), key=lambda entry: (-entry[1], entry[0]))
    ]
