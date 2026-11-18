import itertools
from datetime import UTC, datetime, timedelta
from typing import Any

from app.models import RiskAssessment, RiskCategory, ScoredEvent, WikiEvent

BASE_TIME = datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)
_ids = itertools.count(1)


def at(seconds: float) -> datetime:
    return BASE_TIME + timedelta(seconds=seconds)


def raw_event(**overrides: Any) -> dict[str, Any]:
    """A recentchange payload shaped like the live Wikimedia stream."""
    event_id = overrides.pop("event_id", f"evt-{next(_ids)}")
    domain = overrides.pop("domain", "en.wikipedia.org")
    seconds = overrides.pop("seconds", 0)
    payload: dict[str, Any] = {
        "$schema": "/mediawiki/recentchange/1.0.0",
        "meta": {
            "id": event_id,
            "domain": domain,
            "dt": at(seconds).isoformat().replace("+00:00", "Z"),
            "stream": "mediawiki.recentchange",
        },
        "id": 1,
        "type": "edit",
        "namespace": 0,
        "title": "Example page",
        "comment": "copyedit",
        "timestamp": int(at(seconds).timestamp()),
        "user": "ExampleUser",
        "bot": False,
        "notify_url": f"https://{domain}/w/index.php?diff=2&oldid=1",
        "minor": False,
        "length": {"old": 1_000, "new": 1_050},
        "revision": {"old": 1, "new": 2},
        "wiki": "enwiki",
    }
    payload.update(overrides)
    return payload


def wiki_event(**overrides: Any) -> WikiEvent:
    fields: dict[str, Any] = {
        "id": f"evt-{next(_ids)}",
        "domain": "en.wikipedia.org",
        "wiki": "enwiki",
        "title": "Example page",
        "namespace": 0,
        "type": "edit",
        "user": "ExampleUser",
        "bot": False,
        "minor": False,
        "timestamp": BASE_TIME,
        "comment": "copyedit",
        "old_length": 1_000,
        "new_length": 1_050,
        "old_revision": 1,
        "new_revision": 2,
        "diff_url": None,
    }
    if "seconds" in overrides:
        fields["timestamp"] = at(overrides.pop("seconds"))
    fields.update(overrides)
    return WikiEvent(**fields)


def scored(category: RiskCategory = RiskCategory.NORMAL, **overrides: Any) -> ScoredEvent:
    return ScoredEvent(
        event=wiki_event(**overrides),
        risk=RiskAssessment(score=0, category=category),
    )
