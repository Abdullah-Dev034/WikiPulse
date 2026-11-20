import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from app.processing.timestamps import event_seconds

MAX_REPLAY_SLEEP_SECONDS = 1.0


async def replay_events(path: Path, speed: float, loop: bool = True) -> AsyncIterator[str]:
    """Yield recorded stream payloads (one JSON object per line), paced by their timestamps.

    speed=10 plays ten times faster than real time; speed<=0 yields without waiting.
    When looping, each pass shifts timestamps forward by the recording's span and gives
    events new ids, so the pipeline sees fresh events rather than duplicates.
    """
    text = await asyncio.to_thread(path.read_text, encoding="utf-8")
    lines = [line for line in text.splitlines() if line.strip()]
    timestamps = [_timestamp(line) for line in lines]
    known = [ts for ts in timestamps if ts is not None]
    span = int(max(known) - min(known)) + 1 if known else 1

    replay_pass = 0
    while True:
        # Recorded events are slightly out of order, so pace by the furthest time reached.
        clock: float | None = None
        for line, timestamp in zip(lines, timestamps, strict=True):
            if timestamp is not None and (clock is None or timestamp > clock):
                if speed > 0 and clock is not None:
                    await asyncio.sleep(min((timestamp - clock) / speed, MAX_REPLAY_SLEEP_SECONDS))
                clock = timestamp
            yield _shift(line, replay_pass, replay_pass * span) if replay_pass else line
        if not loop:
            return
        replay_pass += 1
        await asyncio.sleep(0)


def _timestamp(line: str) -> float | None:
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return None
    return event_seconds(payload) if isinstance(payload, dict) else None


def _shift(line: str, replay_pass: int, offset_seconds: int) -> str:
    """Move an event forward in time and give it a new id. Timestamps are written back in
    seconds (the source may use milliseconds). Lines that are not events pass through."""
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return line
    if not isinstance(payload, dict):
        return line
    seconds = event_seconds(payload)
    meta = payload.get("meta")
    if seconds is not None:
        shifted = int(seconds) + offset_seconds
        payload["timestamp"] = shifted
        if isinstance(meta, dict):
            meta["dt"] = datetime.fromtimestamp(shifted, UTC).isoformat()
    if isinstance(meta, dict) and isinstance(meta.get("id"), str):
        meta["id"] = f"{meta['id']}~{replay_pass}"
    return json.dumps(payload)
