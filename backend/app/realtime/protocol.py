"""WebSocket message contract. Mirrored in frontend/src/types/protocol.ts."""

from typing import Literal

from pydantic import BaseModel

from app.models import DashboardStats, EventFilter, ScoredEvent, WikiCount

UpstreamState = Literal["connecting", "live", "reconnecting", "replay", "stopped"]


class SubscribeMessage(BaseModel):
    """Client -> server: change what this connection is filtered to."""

    type: Literal["subscribe"]
    wiki: str | None = None
    include_bots: bool = True

    def to_filter(self) -> EventFilter:
        return EventFilter(wiki=self.wiki, include_bots=self.include_bots)


class Snapshot(BaseModel):
    stats: DashboardStats
    wikis: list[WikiCount]
    feed: list[ScoredEvent]
    upstream: UpstreamState


class StatsPayload(BaseModel):
    stats: DashboardStats
    wikis: list[WikiCount]


class UpstreamStatus(BaseModel):
    state: UpstreamState


class SnapshotMessage(BaseModel):
    type: Literal["snapshot"] = "snapshot"
    data: Snapshot


class EventsMessage(BaseModel):
    type: Literal["events"] = "events"
    data: list[ScoredEvent]


class StatsMessage(BaseModel):
    type: Literal["stats"] = "stats"
    data: StatsPayload


class StatusMessage(BaseModel):
    type: Literal["status"] = "status"
    data: UpstreamStatus
