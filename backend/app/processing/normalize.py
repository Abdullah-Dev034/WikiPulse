from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from app.models import WikiEvent

# "Edit" means a change to page content: ordinary edits and page creations.
# log and categorize events are not edits, and canary events are Wikimedia health checks.
COUNTED_TYPES = frozenset({"edit", "new"})
CANARY_DOMAIN = "canary"


class MalformedEventError(ValueError):
    """The payload cannot be turned into a WikiEvent."""


def normalize_event(raw: object) -> WikiEvent | None:
    """Return a WikiEvent, or None for events that are valid but not counted as edits.

    Raises MalformedEventError when required fields are missing or have the wrong type.
    """
    if not isinstance(raw, Mapping):
        raise MalformedEventError("payload is not a JSON object")
    meta = raw.get("meta")
    if not isinstance(meta, Mapping):
        raise MalformedEventError("payload has no meta object")
    if meta.get("domain") == CANARY_DOMAIN or raw.get("type") not in COUNTED_TYPES:
        return None

    length = _optional_mapping(raw.get("length"))
    revision = _optional_mapping(raw.get("revision"))
    try:
        return WikiEvent(
            id=meta["id"],
            domain=meta["domain"],
            wiki=raw.get("wiki") or meta["domain"],
            title=raw["title"],
            namespace=raw.get("namespace"),
            type=raw["type"],
            user=raw.get("user") or "",
            bot=raw.get("bot", False),
            minor=raw.get("minor", False),
            timestamp=raw.get("timestamp") or meta["dt"],
            comment=raw.get("comment") or "",
            old_length=length.get("old"),
            new_length=length.get("new"),
            old_revision=revision.get("old"),
            new_revision=revision.get("new"),
            diff_url=raw.get("notify_url"),
        )
    except (KeyError, ValidationError) as exc:
        raise MalformedEventError(str(exc)) from exc


def _optional_mapping(value: object) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}
