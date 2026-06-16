"""
Central Groq client — rate-limited, single entry point.
Carried over from v1 with TaskPriority renamed to match new service names.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, AsyncIterator, Optional

from groq import AsyncGroq

from core.config import get_settings
from core.logging_config import get_logger
from infrastructure.services.groq_rate_limiter import (
    GroqRateLimiter,
    TaskPriority,
    get_groq_rate_limiter,
)

logger = get_logger(__name__)


def _estimate_prompt_tokens(messages: list[dict[str, Any]]) -> int:
    total_chars = 0
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, str):
            total_chars += len(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    text = part.get("text")
                    if isinstance(text, str):
                        total_chars += len(text)
    return max(1, total_chars // 4)


class GroqClient:
    def __init__(self, api_key: str, limiter: GroqRateLimiter, default_model: str) -> None:
        self._client = AsyncGroq(api_key=api_key) if api_key else None
        self._limiter = limiter
        self._default_model = default_model

    @property
    def is_available(self) -> bool:
        return self._client is not None

    @property
    def default_model(self) -> str:
        return self._default_model

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.3,
        priority: int = TaskPriority.SYNTHESIS,
        extra: Optional[dict[str, Any]] = None,
    ):
        if self._client is None:
            raise RuntimeError("Groq client not configured (GROQ_API_KEY missing)")
        estimated = _estimate_prompt_tokens(messages) + max_tokens
        await self._limiter.acquire(estimated, priority=priority)
        params: dict[str, Any] = {
            "model": model or self._default_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if extra:
            params.update(extra)
        response = await self._client.chat.completions.create(**params)
        if getattr(response, "usage", None) is not None:
            self._limiter.record_actual_usage(actual_tokens=response.usage.total_tokens, estimated=estimated)
        return response

    async def chat_completion_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        model: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        priority: int = TaskPriority.CHAT,
        extra: Optional[dict[str, Any]] = None,
    ) -> AsyncIterator[Any]:
        if self._client is None:
            raise RuntimeError("Groq client not configured (GROQ_API_KEY missing)")
        estimated = _estimate_prompt_tokens(messages) + max_tokens
        await self._limiter.acquire(estimated, priority=priority)
        params: dict[str, Any] = {
            "model": model or self._default_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        if extra:
            params.update(extra)
        stream = await self._client.chat.completions.create(**params)
        final_usage = None
        async for chunk in stream:
            usage = getattr(chunk, "usage", None)
            if usage is not None:
                final_usage = usage
            yield chunk
        if final_usage is not None:
            self._limiter.record_actual_usage(actual_tokens=final_usage.total_tokens, estimated=estimated)


@lru_cache(maxsize=1)
def get_groq_client() -> GroqClient:
    s = get_settings()
    return GroqClient(api_key=s.GROQ_API_KEY, limiter=get_groq_rate_limiter(), default_model=s.LLM_MODEL)
