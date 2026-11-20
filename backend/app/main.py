import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import Settings, get_settings
from app.ingestion.live import live_events
from app.ingestion.replay import replay_events
from app.pipeline import Pipeline

logger = logging.getLogger(__name__)


def _event_source(settings: Settings, pipeline: Pipeline) -> AsyncIterator[str]:
    if settings.stream_source == "live":
        return live_events(settings.stream_url, settings.user_agent, pipeline.set_upstream)
    pipeline.set_upstream("replay")
    return replay_events(settings.replay_file, settings.replay_speed, settings.replay_loop)


async def _run_ingestion(pipeline: Pipeline, source: AsyncIterator[str]) -> None:
    try:
        await pipeline.ingest(source)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Ingestion stopped unexpectedly")
    pipeline.set_upstream("stopped")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        pipeline = Pipeline()
        app.state.pipeline = pipeline
        tasks = [
            asyncio.create_task(_run_ingestion(pipeline, _event_source(settings, pipeline))),
            asyncio.create_task(pipeline.run_broadcaster(settings.broadcast_interval_seconds)),
        ]
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(title="WikiPulse", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = create_app()
