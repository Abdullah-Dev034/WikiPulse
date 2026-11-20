from collections.abc import Mapping
from datetime import UTC, datetime

# Epoch values above this are milliseconds: as seconds it would be the year 5138.
MILLISECONDS_THRESHOLD = 100_000_000_000


def epoch_seconds(value: object) -> float | None:
    """Unix time in seconds from an epoch number in seconds or milliseconds."""
    if isinstance(value, bool) or not isinstance(value, int | float) or value <= 0:
        return None
    return value / 1000 if value > MILLISECONDS_THRESHOLD else float(value)


def event_seconds(raw: Mapping[str, object]) -> float | None:
    """Event time of a recentchange payload: `timestamp`, else `meta.dt`."""
    seconds = epoch_seconds(raw.get("timestamp"))
    if seconds is not None:
        return seconds
    meta = raw.get("meta")
    dt = meta.get("dt") if isinstance(meta, Mapping) else None
    if not isinstance(dt, str):
        return None
    try:
        parsed = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.timestamp()
