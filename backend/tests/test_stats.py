from app.models import EventFilter, RiskCategory, ScoredEvent
from app.processing.stats import build_stats, wiki_activity
from app.processing.store import EventStore
from tests.factories import at, scored


def store_with(*items: ScoredEvent) -> EventStore:
    store = EventStore()
    for item in items:
        store.add(item)
    return store


def test_empty_store_gives_zeroed_stats() -> None:
    stats = build_stats(EventStore())

    assert stats.as_of is None
    assert stats.edits_last_minute == 0
    assert stats.top_pages == []


def test_edits_per_minute_uses_a_half_open_event_time_window() -> None:
    store = store_with(
        scored(seconds=240),  # exactly 60s before now: outside (now-60, now]
        scored(seconds=241),
        scored(seconds=300),
    )

    stats = build_stats(store)

    assert stats.as_of == at(300)
    assert stats.edits_last_minute == 2
    assert stats.edits_last_5_minutes == 3


def test_events_expire_from_the_five_minute_window() -> None:
    store = store_with(scored(seconds=0), scored(seconds=1), scored(seconds=300))

    stats = build_stats(store)

    assert stats.edits_last_5_minutes == 2
    assert len(store) == 2


def test_out_of_order_events_count_in_the_right_window() -> None:
    store = store_with(scored(seconds=300), scored(seconds=230), scored(seconds=290))

    stats = build_stats(store)

    assert stats.as_of == at(300)
    assert stats.edits_last_minute == 2
    assert stats.edits_last_5_minutes == 3


def test_top_pages_are_ranked_by_count_then_name_and_capped_at_ten() -> None:
    items = [scored(title="Busy", seconds=1) for _ in range(3)]
    items += [scored(title="Beta", seconds=1), scored(title="Alpha", seconds=1)]
    items += [scored(title=f"Page {n:02}", seconds=1) for n in range(12)]

    top = build_stats(store_with(*items)).top_pages

    assert len(top) == 10
    assert (top[0].title, top[0].edits) == ("Busy", 3)
    assert [page.title for page in top[1:3]] == ["Alpha", "Beta"]


def test_same_title_on_different_wikis_is_counted_separately() -> None:
    store = store_with(
        scored(title="Paris", domain="en.wikipedia.org"),
        scored(title="Paris", domain="fr.wikipedia.org"),
    )

    top = build_stats(store).top_pages

    assert {(page.domain, page.edits) for page in top} == {
        ("en.wikipedia.org", 1),
        ("fr.wikipedia.org", 1),
    }


def test_wiki_filter_applies_to_every_statistic() -> None:
    store = store_with(
        scored(domain="en.wikipedia.org", title="A", seconds=290),
        scored(domain="en.wikipedia.org", title="A", seconds=295),
        scored(domain="de.wikipedia.org", title="B", seconds=299, category=RiskCategory.SUSPICIOUS),
        scored(domain="en.wikipedia.org", title="C", seconds=300),
    )

    stats = build_stats(store, EventFilter(wiki="de.wikipedia.org"))

    assert stats.filter.wiki == "de.wikipedia.org"
    assert stats.edits_last_minute == 1
    assert stats.edits_last_5_minutes == 1
    assert stats.active_wikis == 1
    assert stats.suspicious_last_5_minutes == 1
    assert [page.title for page in stats.top_pages] == ["B"]
    assert sum(point.edits for point in stats.activity) == 1


def test_activity_has_thirty_ten_second_buckets_ending_now() -> None:
    store = store_with(scored(seconds=1), scored(seconds=290), scored(seconds=300))

    activity = build_stats(store).activity

    assert len(activity) == 30
    assert activity[-1].end == at(300)
    assert activity[-1].edits == 1  # (290, 300]
    assert activity[-2].edits == 1  # (280, 290]: a boundary edit belongs to the earlier bucket
    assert activity[0].edits == 1  # (0, 10]
    assert sum(point.edits for point in activity) == 3


def test_suspicious_count_includes_needs_review() -> None:
    store = store_with(
        scored(category=RiskCategory.SUSPICIOUS),
        scored(category=RiskCategory.NEEDS_REVIEW),
        scored(category=RiskCategory.NORMAL),
    )

    assert build_stats(store).suspicious_last_5_minutes == 2


def test_wiki_activity_lists_busiest_wikis_first() -> None:
    store = store_with(
        scored(domain="de.wikipedia.org"),
        scored(domain="en.wikipedia.org"),
        scored(domain="en.wikipedia.org"),
    )

    assert [(w.domain, w.edits) for w in wiki_activity(store)] == [
        ("en.wikipedia.org", 2),
        ("de.wikipedia.org", 1),
    ]


def test_store_never_exceeds_max_events() -> None:
    store = EventStore(max_events=3)
    for second in range(10):
        store.add(scored(seconds=second))

    assert len(store) == 3
    assert [item.event.timestamp for item in store.latest(10)] == [at(9), at(8), at(7)]


def test_latest_filters_by_wiki_newest_first() -> None:
    store = store_with(
        scored(domain="en.wikipedia.org", title="old"),
        scored(domain="de.wikipedia.org", title="other"),
        scored(domain="en.wikipedia.org", title="new"),
    )

    titles = [item.event.title for item in store.latest(5, EventFilter(wiki="en.wikipedia.org"))]

    assert titles == ["new", "old"]


def test_bot_filter_excludes_bot_edits_everywhere() -> None:
    store = store_with(
        scored(title="Bot page", bot=True),
        scored(title="Bot page", bot=True),
        scored(title="Human page"),
    )

    stats = build_stats(store, EventFilter(include_bots=False))

    assert stats.edits_last_5_minutes == 1
    assert [page.title for page in stats.top_pages] == ["Human page"]
    assert [w.edits for w in wiki_activity(store, include_bots=False)] == [1]
