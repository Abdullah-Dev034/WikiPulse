"""Runs the provided sample_events.jsonl through the real processor.

The sample deliberately contains malformed lines, duplicates, missing fields, millisecond
timestamps, prompt-injection and HTML in edit summaries. These numbers pin how each is handled.
"""

from collections import Counter
from pathlib import Path

import pytest

from app.processing.processor import EventProcessor
from app.processing.store import EventStore
from app.processing.vandalism import VandalismScorer

SAMPLE = Path(__file__).resolve().parents[2] / "data" / "sample_events.jsonl"


@pytest.fixture(scope="module")
def processed() -> tuple[EventProcessor, list]:
    processor = EventProcessor(EventStore(), VandalismScorer())
    accepted = []
    for line in SAMPLE.read_text(encoding="utf-8").splitlines():
        scored = processor.process_json(line)
        if scored is not None:
            accepted.append(scored)
    return processor, accepted


def test_every_line_is_accounted_for(processed: tuple[EventProcessor, list]) -> None:
    counters = processed[0].counters

    assert counters.received == 2_000
    # 1 invalid JSON line and 2 edits without a title.
    assert counters.malformed == 3
    assert counters.duplicates == 28
    assert counters.skipped == 237  # log and categorize events
    assert counters.late == 0
    assert counters.accepted == 1_732


def test_millisecond_and_missing_timestamps_land_inside_the_recording(
    processed: tuple[EventProcessor, list],
) -> None:
    times = [item.event.timestamp for item in processed[1]]

    assert min(times).isoformat() == "2026-11-18T10:00:00+00:00"
    assert max(times).isoformat() == "2026-11-18T10:11:59+00:00"


def test_planted_attacks_are_flagged_and_nothing_else(
    processed: tuple[EventProcessor, list],
) -> None:
    flagged = [item for item in processed[1] if item.risk.category != "normal"]
    codes = Counter(signal.code for item in flagged for signal in item.risk.signals)

    assert sorted(item.event.title for item in flagged) == [
        "Changement climatique",
        "Climate change",
        "London",
    ]
    assert codes["instruction_in_summary"] == 1
    assert codes["markup_in_summary"] == 2
