from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stream_url: str = "https://stream.wikimedia.org/v2/stream/recentchange"
    # Live ingestion is built on the provided stream_client.py starter file (pending).
    stream_source: Literal["live", "replay"] = "replay"
    replay_file: Path = Path("../data/recorded_events.jsonl")
    replay_speed: float = 1.0
    replay_loop: bool = True
    user_agent: str = "WikiPulse/0.1 (technical assessment demo)"

    broadcast_interval_seconds: float = 1.0

    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "llama3.2:3b"
    llm_api_key: SecretStr = SecretStr("")
    pulse_interval_seconds: int = 45

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
