import json

from app.processing.processor import EventProcessor, RecentIds
from app.processing.store import EventStore
from app.processing.vandalism import VandalismScorer
from tests.factories import raw_event


def make_processor() -> tuple[EventProcessor, EventStore]:
    store = EventStore()
    return EventProcessor(store, VandalismScorer()), store


def test_valid_event_is_scored_and_stored() -> None:
    processor, store = make_processor()

    result = processor.process(raw_event())

    assert result is not None
    assert len(store) == 1
    assert processor.counters.accepted == 1


def test_duplicate_ids_are_processed_once() -> None:
    processor, store = make_processor()

    first = processor.process(raw_event(event_id="same"))
    second = processor.process(raw_event(event_id="same"))

    assert first is not None
    assert second is None
    assert len(store) == 1
    assert processor.counters.duplicates == 1


def test_bad_input_is_counted_not_raised() -> None:
    processor, store = make_processor()

    processor.process_json("{not json")
    processor.process_json(json.dumps({"type": "edit"}))
    processor.process(raw_event(type="log"))

    assert len(store) == 0
    assert processor.counters.malformed == 2
    assert processor.counters.skipped == 1
    assert processor.counters.received == 3


def test_events_older_than_the_window_are_dropped_as_late() -> None:
    processor, store = make_processor()
    processor.process(raw_event(seconds=600))

    late = processor.process(raw_event(seconds=100))

    assert late is None
    assert processor.counters.late == 1
    assert len(store) == 1


def test_recent_ids_forgets_oldest_beyond_capacity() -> None:
    ids = RecentIds(capacity=2)

    for event_id in ("a", "b", "c"):
        assert ids.add(event_id) is True

    assert ids.add("a") is True
    assert ids.add("c") is False
