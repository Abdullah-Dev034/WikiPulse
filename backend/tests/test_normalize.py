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
        {**raw_event(timestamp="yesterday"), "meta": {"id": "x", "domain": "en.wikipedia.org"}},
        {**raw_event(id=None), "meta": {"domain": "en.wikipedia.org"}},
        {**raw_event(), "meta": "not an object"},
    ],
    ids=["not-object", "no-domain", "null-title", "no-usable-time", "no-id", "bad-meta"],
)
def test_malformed_payloads_raise(payload: object) -> None:
    with pytest.raises(MalformedEventError):
        normalize_event(payload)


def test_millisecond_timestamps_are_converted() -> None:
    event = normalize_event(raw_event(timestamp=int(at(7).timestamp()) * 1000))

    assert event is not None
    assert event.timestamp == at(7)


def test_unparseable_timestamp_falls_back_to_meta_dt() -> None:
    event = normalize_event(raw_event(seconds=3, timestamp="yesterday"))

    assert event is not None
    assert event.timestamp == at(3)


def test_missing_meta_falls_back_to_top_level_fields() -> None:
    payload = raw_event(id=176201941, server_name="en.wikipedia.org", seconds=9)
    del payload["meta"]

    event = normalize_event(payload)

    assert event is not None
    assert event.domain == "en.wikipedia.org"
    assert event.id == f"rc:en.wikipedia.org:176201941:{int(at(9).timestamp())}"


def test_null_bot_flag_counts_as_human() -> None:
    event = normalize_event(raw_event(bot=None))

    assert event is not None
    assert event.bot is False


def test_builds_diff_url_from_revisions_when_notify_url_missing() -> None:
    payload = raw_event(server_url="https://fr.wikipedia.org", server_script_path="/w")
    del payload["notify_url"]

    event = normalize_event(payload)

    assert event is not None
    assert event.diff_url == "https://fr.wikipedia.org/w/index.php?diff=2&oldid=1"
