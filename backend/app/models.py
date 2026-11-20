from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class WikiEvent(BaseModel):
    """A normalised edit from the Wikimedia recentchange stream."""

    model_config = ConfigDict(frozen=True)

    id: str
    domain: str
    wiki: str
    title: str
    namespace: int | None
    type: Literal["edit", "new"]
    user: str
    bot: bool
    minor: bool
    timestamp: datetime
    comment: str
    old_length: int | None
    new_length: int | None
    old_revision: int | None
    new_revision: int | None
    diff_url: str | None

    @field_validator("timestamp")
    @classmethod
    def _to_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @property
    def size_delta(self) -> int | None:
        if self.old_length is None or self.new_length is None:
            return None
        return self.new_length - self.old_length


class EventFilter(BaseModel):
    """What a dashboard viewer is looking at: one wiki or all, with or without bot edits."""

    model_config = ConfigDict(frozen=True)

    wiki: str | None = None
    include_bots: bool = True

    def matches(self, event: WikiEvent) -> bool:
        return (self.wiki is None or event.domain == self.wiki) and (
            self.include_bots or not event.bot
        )


class RiskCategory(StrEnum):
    NORMAL = "normal"
    NEEDS_REVIEW = "needs_review"
    SUSPICIOUS = "suspicious"


class RiskSignal(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: str
    description: str
    weight: int


class RiskAssessment(BaseModel):
    model_config = ConfigDict(frozen=True)

    score: int
    category: RiskCategory
    signals: tuple[RiskSignal, ...] = ()
    reason: str = ""


class ScoredEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    event: WikiEvent
    risk: RiskAssessment


class PageCount(BaseModel):
    domain: str
    title: str
    edits: int


class WikiCount(BaseModel):
    domain: str
    edits: int


class ActivityPoint(BaseModel):
    end: datetime
    edits: int


class DashboardStats(BaseModel):
    as_of: datetime | None
    filter: EventFilter
    edits_last_minute: int
    edits_last_5_minutes: int
    active_wikis: int
    suspicious_last_5_minutes: int
    top_pages: list[PageCount]
    activity: list[ActivityPoint]
