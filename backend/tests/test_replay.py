import json
from pathlib import Path

import pytest

from app.ingestion.replay import replay_events
from tests.factories import raw_event


def write_recording(path: Path, count: int) -> Path:
    lines = [json.dumps(raw_event(event_id=f"r{n}", seconds=n)) for n in range(count)]
    path.write_text("\n".join([*lines, "", "{broken"]), encoding="utf-8")
    return path


async def test_single_pass_yields_every_line_in_order(tmp_path: Path) -> None:
    recording = write_recording(tmp_path / "events.jsonl", 3)

    lines = [line async for line in replay_events(recording, speed=0, loop=False)]

    assert len(lines) == 4  # blank line dropped, broken line passed through for the processor
    assert [json.loads(line)["meta"]["id"] for line in lines[:3]] == ["r0", "r1", "r2"]


async def test_looping_shifts_time_and_ids_so_events_stay_fresh(tmp_path: Path) -> None:
    recording = write_recording(tmp_path / "events.jsonl", 3)
    source = replay_events(recording, speed=0, loop=True)

    first_pass = [await anext(source) for _ in range(4)]
    second = json.loads(await anext(source))

    first = json.loads(first_pass[0])
    assert second["meta"]["id"] == "r0~1"
    assert second["timestamp"] == first["timestamp"] + 3
    await source.aclose()


async def test_out_of_order_recording_only_waits_when_time_moves_forward(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    monkeypatch.setattr("app.ingestion.replay.asyncio.sleep", fake_sleep)
    order = [0, 1, 0, 1, 2, 1, 2]
    lines = [json.dumps(raw_event(event_id=f"o{n}", seconds=s)) for n, s in enumerate(order)]
    recording = tmp_path / "events.jsonl"
    recording.write_text("\n".join(lines), encoding="utf-8")

    yielded = [line async for line in replay_events(recording, speed=1, loop=False)]

    assert len(yielded) == len(order)
    assert sleeps == [1.0, 1.0]
