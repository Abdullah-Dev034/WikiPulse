from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stream_url: str = "https://stream.wikimedia.org/v2/stream/recentchange"
    stream_source: Literal["live", "replay"] = "live"
    replay_file: str = "../sample_events.jsonl"
    replay_speed: float = 10.0
    user_agent: str = "WikiPulse/0.1 (technical assessment demo)"

    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "llama3.2:3b"
    llm_api_key: str = ""
    pulse_interval_seconds: int = 45

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
