from datetime import UTC, datetime

import pytest

from app.processing.normalize import MalformedEventError, normalize_event
from tests.factories import at, raw_event


def test_normalizes_a_live_shaped_edit() -> None:
    event = normalize_event(raw_event(event_id="abc", seconds=5, title="Python"))

    assert event is not None
    assert event.id == "abc"
    assert event.domain == "en.wikipedia.org"
    assert event.title == "Python"
    assert event.timestamp == at(5)
    assert event.timestamp.tzinfo == UTC
    assert (event.old_length, event.new_length) == (1_000, 1_050)
    assert event.size_delta == 50


def test_page_creation_keeps_zero_old_length() -> None:
    event = normalize_event(raw_event(type="new", length={"new": 300}, revision={"new": 9}))

    assert event is not None
    assert event.old_length is None
    assert event.new_length == 300
    assert event.size_delta is None


@pytest.mark.parametrize("event_type", ["log", "categorize", "external"])
def test_non_edit_types_are_skipped(event_type: str) -> None:
    assert normalize_event(raw_event(type=event_type)) is None


def test_canary_events_are_skipped() -> None:
    assert normalize_event(raw_event(domain="canary")) is None


def test_optional_fields_default_safely() -> None:
    payload = raw_event()
    for field in ("user", "bot", "minor", "comment", "length", "revision", "notify_url"):
        del payload[field]

    event = normalize_event(payload)

    assert event is not None
    assert event.user == ""
    assert event.bot is False
    assert event.comment == ""
    assert event.old_length is None
    assert event.diff_url is None


def test_falls_back_to_meta_dt_when_timestamp_missing() -> None:
    payload = raw_event()
    del payload["timestamp"]
    payload["meta"]["dt"] = "2026-11-18T13:00:00+01:00"

    event = normalize_event(payload)

    assert event is not None
    assert event.timestamp == datetime(2026, 11, 18, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    "payload",
    [
        "not an object",
        {"type": "edit"},
        raw_event(title=None),
        raw_event(timestamp="yesterday"),
        {**raw_event(), "meta": {"domain": "en.wikipedia.org"}},
    ],
    ids=["not-object", "no-meta", "null-title", "bad-timestamp", "no-id"],
)
def test_malformed_payloads_raise(payload: object) -> None:
    with pytest.raises(MalformedEventError):
        normalize_event(payload)
