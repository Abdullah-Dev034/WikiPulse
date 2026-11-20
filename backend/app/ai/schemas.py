from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

PulseStatus = Literal["disabled", "pending", "ok", "error"]
Verdict = Literal["likely_vandalism", "unclear", "likely_fine"]


class PulseSummary(BaseModel):
    """The AI pulse shown on the dashboard. On a failed refresh the last good text is kept
    (status "error", `detail` says why) so viewers can see it is out of date."""

    model_config = ConfigDict(frozen=True)

    status: PulseStatus
    text: str | None = None
    generated_at: datetime | None = None
    data_as_of: datetime | None = None
    model: str | None = None
    detail: str | None = None


class AIReview(BaseModel):
    """An LLM's second opinion on a rule-flagged edit. Advisory only: it never changes the
    rule-based risk category."""

    model_config = ConfigDict(frozen=True)

    event_id: str
    verdict: Verdict
    reason: str
    model: str
