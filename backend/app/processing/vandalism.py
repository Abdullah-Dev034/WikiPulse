import ipaddress
import re
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.models import RiskAssessment, RiskCategory, RiskSignal, WikiEvent

ARTICLE_NAMESPACE = 0
# Logged-out editors on Wikimedia wikis now get temporary accounts such as "~2026-55293-33".
TEMPORARY_ACCOUNT = re.compile(r"^~\d{4}-\d+-\d+$")
REVERT_COMMENT = re.compile(r"\b(revert(ed|ing)?|undid revision|undo|rvv?|rollback)\b", re.I)
DEFAULT_SUSPICIOUS_TERMS = (
    "lol",
    "lmao",
    "rofl",
    "haha",
    "hahaha",
    "poop",
    "stupid",
    "idiot",
    "dumb",
    "sucks",
    "hacked",
    "asdf",
)

LIMITATIONS = (
    "Scored from edit metadata only (size change, comment, editor type, timing). "
    "The page content and diff are not analysed, so signals indicate review priority, "
    "not proof of vandalism."
)


@dataclass(frozen=True)
class RiskConfig:
    large_removal_bytes: int = 2_000
    large_removal_ratio: float = 0.5
    ratio_min_length: int = 500
    blanking_ratio: float = 0.1
    blanking_min_length: int = 1_000
    rapid_edit_count: int = 3
    rapid_edit_window: timedelta = timedelta(minutes=2)
    contested_revert_count: int = 2
    contested_window: timedelta = timedelta(minutes=10)
    suspicious_terms: tuple[str, ...] = DEFAULT_SUSPICIOUS_TERMS

    weight_blanking: int = 50
    weight_large_removal: int = 35
    weight_suspicious_comment: int = 30
    weight_rapid_edits: int = 20
    weight_unregistered: int = 15
    weight_contested_page: int = 15
    weight_missing_summary: int = 10

    review_threshold: int = 30
    suspicious_threshold: int = 60


class VandalismScorer:
    """Rule-based risk scoring for article edits by non-bot users.

    Stateful: remembers recent edits per (user, page) and reverts per page, keyed by event
    time, to detect rapid repeated edits and contested pages.
    """

    def __init__(self, config: RiskConfig | None = None, max_tracked_keys: int = 20_000):
        self._config = config or RiskConfig()
        self._max_tracked_keys = max_tracked_keys
        terms = "|".join(re.escape(term) for term in self._config.suspicious_terms)
        self._suspicious_comment = re.compile(rf"\b({terms})\b", re.I)
        self._user_page_edits: defaultdict[tuple[str, str, str], deque[datetime]] = defaultdict(
            deque
        )
        self._page_reverts: defaultdict[tuple[str, str], deque[datetime]] = defaultdict(deque)

    def assess(self, event: WikiEvent) -> RiskAssessment:
        if event.bot:
            return _not_assessed("Bot edit; not scored.")
        if event.namespace != ARTICLE_NAMESPACE:
            return _not_assessed("Not an article; not scored.")

        self._prune()
        page = (event.domain, event.title)
        if REVERT_COMMENT.search(event.comment):
            _push(self._page_reverts[page], event.timestamp, self._config.contested_window)
            return _not_assessed("Revert of an earlier edit; not scored.")

        recent_edits = self._user_page_edits[(event.user, *page)]
        _push(recent_edits, event.timestamp, self._config.rapid_edit_window)
        page_reverts = self._page_reverts.get(page)
        if page_reverts is not None:
            _expire(page_reverts, event.timestamp, self._config.contested_window)

        signals = [
            *self._size_signals(event),
            *self._editor_signals(event),
            *self._comment_signals(event),
        ]
        if len(recent_edits) >= self._config.rapid_edit_count:
            signals.append(
                RiskSignal(
                    code="rapid_edits",
                    description=f"{len(recent_edits)} edits to this page by the same editor "
                    f"within {_minutes(self._config.rapid_edit_window)}",
                    weight=self._config.weight_rapid_edits,
                )
            )
        if page_reverts is not None and len(page_reverts) >= self._config.contested_revert_count:
            signals.append(
                RiskSignal(
                    code="contested_page",
                    description=f"Page reverted {len(page_reverts)} times "
                    f"in the last {_minutes(self._config.contested_window)}",
                    weight=self._config.weight_contested_page,
                )
            )
        return self._assessment(signals)

    def _size_signals(self, event: WikiEvent) -> list[RiskSignal]:
        old, new = event.old_length, event.new_length
        if old is None or new is None or old == 0 or new >= old:
            return []
        removed = old - new
        ratio = removed / old
        if old >= self._config.blanking_min_length and new <= old * self._config.blanking_ratio:
            return [
                RiskSignal(
                    code="page_blanked",
                    description=f"Page cut from {old:,} to {new:,} bytes ({ratio:.0%} removed)",
                    weight=self._config.weight_blanking,
                )
            ]
        if removed >= self._config.large_removal_bytes or (
            old >= self._config.ratio_min_length and ratio >= self._config.large_removal_ratio
        ):
            return [
                RiskSignal(
                    code="large_removal",
                    description=f"Removed {removed:,} bytes ({ratio:.0%} of the page)",
                    weight=self._config.weight_large_removal,
                )
            ]
        return []

    def _editor_signals(self, event: WikiEvent) -> list[RiskSignal]:
        if not is_unregistered(event.user):
            return []
        return [
            RiskSignal(
                code="unregistered_editor",
                description="Edit by an unregistered (IP or temporary) account",
                weight=self._config.weight_unregistered,
            )
        ]

    def _comment_signals(self, event: WikiEvent) -> list[RiskSignal]:
        comment = event.comment.strip()
        if not comment:
            if event.type == "new":
                return []
            return [
                RiskSignal(
                    code="missing_summary",
                    description="No edit summary",
                    weight=self._config.weight_missing_summary,
                )
            ]
        match = self._suspicious_comment.search(comment)
        if match is None:
            return []
        return [
            RiskSignal(
                code="suspicious_comment",
                description=f'Edit summary contains "{match.group(0)}"',
                weight=self._config.weight_suspicious_comment,
            )
        ]

    def _assessment(self, signals: list[RiskSignal]) -> RiskAssessment:
        score = min(100, sum(signal.weight for signal in signals))
        if score >= self._config.suspicious_threshold:
            category = RiskCategory.SUSPICIOUS
        elif score >= self._config.review_threshold:
            category = RiskCategory.NEEDS_REVIEW
        else:
            category = RiskCategory.NORMAL
        return RiskAssessment(
            score=score,
            category=category,
            signals=tuple(signals),
            reason="; ".join(signal.description for signal in signals),
        )

    def _prune(self) -> None:
        """Cheap memory bound: forget all history once too many keys are tracked."""
        for tracked in (self._user_page_edits, self._page_reverts):
            if len(tracked) > self._max_tracked_keys:
                tracked.clear()


def is_unregistered(user: str) -> bool:
    if TEMPORARY_ACCOUNT.match(user):
        return True
    try:
        ipaddress.ip_address(user)
    except ValueError:
        return False
    return True


def _push(times: deque[datetime], timestamp: datetime, window: timedelta) -> None:
    times.append(timestamp)
    _expire(times, timestamp, window)


def _expire(times: deque[datetime], now: datetime, window: timedelta) -> None:
    while times and times[0] <= now - window:
        times.popleft()


def _minutes(window: timedelta) -> str:
    minutes = int(window.total_seconds() // 60)
    return f"{minutes} minute" if minutes == 1 else f"{minutes} minutes"


def _not_assessed(reason: str) -> RiskAssessment:
    return RiskAssessment(score=0, category=RiskCategory.NORMAL, reason=reason)
