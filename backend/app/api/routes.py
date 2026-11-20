from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Request, WebSocket

from app.models import EventFilter
from app.pipeline import Pipeline
from app.realtime.protocol import Snapshot

router = APIRouter()


def _pipeline(app_state: Any) -> Pipeline:
    pipeline: Pipeline = app_state.pipeline
    return pipeline


@router.get("/api/health")
async def health(request: Request) -> dict[str, Any]:
    pipeline = _pipeline(request.app.state)
    return {
        "status": "ok",
        "upstream": pipeline.upstream,
        "clients": pipeline.hub.client_count,
        "events_in_window": len(pipeline.store),
        "ai_pulse": pipeline.pulse.status,
        "ai_reviews": len(pipeline.ai_reviews),
        "processor": asdict(pipeline.processor.counters),
    }


@router.get("/api/snapshot")
async def snapshot(
    request: Request, wiki: str | None = None, include_bots: bool = True
) -> Snapshot:
    event_filter = EventFilter(wiki=wiki, include_bots=include_bots)
    return _pipeline(request.app.state).snapshot(event_filter)


@router.websocket("/ws")
async def dashboard_socket(websocket: WebSocket) -> None:
    await _pipeline(websocket.app.state).hub.serve(websocket)
