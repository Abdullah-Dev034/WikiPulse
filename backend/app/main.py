import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.llm import OpenAICompatibleModel
from app.ai.pulse import PulseService
from app.ai.review import EditReviewer
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


def _chat_model(settings: Settings) -> OpenAICompatibleModel | None:
    if not settings.ai_enabled or not settings.llm_base_url:
        logger.info("AI features disabled")
        return None
    return OpenAICompatibleModel(settings.llm_base_url, settings.llm_model, settings.llm_api_key)


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
        model = _chat_model(settings)
        pulse = PulseService(
            model, pipeline.pulse_facts, pipeline.set_pulse, settings.pulse_interval_seconds
        )
        pipeline.pulse = pulse.current
        tasks = [
            asyncio.create_task(_run_ingestion(pipeline, _event_source(settings, pipeline))),
            asyncio.create_task(pipeline.run_broadcaster(settings.broadcast_interval_seconds)),
            asyncio.create_task(pulse.run()),
        ]
        if model is not None:
            reviewer = EditReviewer(model, pipeline.add_review, settings.review_interval_seconds)
            pipeline.on_flagged = reviewer.submit
            tasks.append(asyncio.create_task(reviewer.run()))
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            if model is not None:
                await model.aclose()

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
