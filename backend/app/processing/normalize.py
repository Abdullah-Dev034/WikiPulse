from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from app.models import WikiEvent
from app.processing.timestamps import event_seconds

# "Edit" means a change to page content: ordinary edits and page creations.
# log and categorize events are not edits, and canary events are Wikimedia health checks.
COUNTED_TYPES = frozenset({"edit", "new"})
CANARY_DOMAIN = "canary"


class MalformedEventError(ValueError):
    """The payload cannot be turned into a WikiEvent."""


def normalize_event(raw: object) -> WikiEvent | None:
    """Return a WikiEvent, or None for events that are valid but not counted as edits.

    Missing optional fields get safe defaults; `meta` falls back to the top-level fields
    (`server_name`, rc `id`, `timestamp`). Raises MalformedEventError when the event has no
    title, domain, time or id, or a field has the wrong type.
    """
    if not isinstance(raw, Mapping):
        raise MalformedEventError("payload is not a JSON object")
    meta = raw.get("meta", {})
    if not isinstance(meta, Mapping):
        raise MalformedEventError("meta is not an object")
    domain = meta.get("domain") or raw.get("server_name")
    if domain == CANARY_DOMAIN or raw.get("type") not in COUNTED_TYPES:
        return None
    if not isinstance(domain, str) or not domain:
        raise MalformedEventError("event has no domain")
    seconds = event_seconds(raw)
    if seconds is None:
        raise MalformedEventError("event has no usable timestamp")

    length = _optional_mapping(raw.get("length"))
    revision = _optional_mapping(raw.get("revision"))
    try:
        return WikiEvent(
            id=meta.get("id") or _fallback_id(raw, domain, seconds),
            domain=domain,
            wiki=raw.get("wiki") or domain,
            title=raw.get("title"),
            namespace=raw.get("namespace"),
            type=raw["type"],
            user=raw.get("user") or "",
            bot=raw.get("bot") or False,
            minor=raw.get("minor") or False,
            timestamp=datetime.fromtimestamp(seconds, UTC),
            comment=raw.get("comment") or "",
            old_length=length.get("old"),
            new_length=length.get("new"),
            old_revision=revision.get("old"),
            new_revision=revision.get("new"),
            diff_url=raw.get("notify_url") or _diff_url(raw, revision),
        )
    except ValidationError as exc:
        raise MalformedEventError(str(exc)) from exc


def _fallback_id(raw: Mapping[str, Any], domain: str, seconds: float) -> str:
    """Stable id for events without meta.id: per-wiki rc id plus event time."""
    rc_id = raw.get("id")
    if not isinstance(rc_id, int):
        raise MalformedEventError("event has no meta.id or rc id")
    return f"rc:{domain}:{rc_id}:{int(seconds)}"


def _diff_url(raw: Mapping[str, Any], revision: Mapping[str, Any]) -> str | None:
    server, old, new = raw.get("server_url"), revision.get("old"), revision.get("new")
    if not isinstance(server, str) or not isinstance(old, int) or not isinstance(new, int):
        return None
    script_path = raw.get("server_script_path") or "/w"
    return f"{server}{script_path}/index.php?diff={new}&oldid={old}"


def _optional_mapping(value: object) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}
