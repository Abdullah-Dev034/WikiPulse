"""Thin client for any OpenAI-compatible chat completions endpoint (Ollama, OpenAI, Groq...)."""

from typing import Protocol

import httpx
from pydantic import SecretStr


class LLMError(Exception):
    """The model could not produce an answer. Messages never include keys or response bodies."""


class ChatModel(Protocol):
    name: str

    async def complete(
        self, system: str, user: str, *, max_tokens: int, json_mode: bool = False
    ) -> str: ...


class OpenAICompatibleModel:
    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: SecretStr,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.name = model
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=timeout_seconds, transport=transport)

    async def complete(
        self, system: str, user: str, *, max_tokens: int, json_mode: bool = False
    ) -> str:
        payload: dict[str, object] = {
            "model": self.name,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        key = self._api_key.get_secret_value()
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        try:
            response = await self._client.post(self._url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise LLMError(f"model server unreachable ({exc.__class__.__name__})") from None
        if response.status_code != httpx.codes.OK:
            raise LLMError(f"model server returned HTTP {response.status_code}")
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LLMError("model server returned an unexpected response") from None
        if not isinstance(content, str) or not content.strip():
            raise LLMError("model returned an empty answer")
        return content.strip()

    async def aclose(self) -> None:
        await self._client.aclose()
