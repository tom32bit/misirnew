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
    def __init__(
        self,
        api_key: str,
        limiter: GroqRateLimiter,
        default_model: str,
        reasoning_format: str = "",
    ) -> None:
        self._client = AsyncGroq(api_key=api_key) if api_key else None
        self._limiter = limiter
        self._default_model = default_model
        self._reasoning_format = reasoning_format

    @property
    def is_available(self) -> bool:
        return self._client is not None

    @property
    def default_model(self) -> str:
        return self._default_model

    def _build_params(
        self, model: str, base: dict[str, Any], extra: Optional[dict[str, Any]]
    ) -> dict[str, Any]:
        """Assemble the request params, merging any caller `extra`.

        Reasoning models (Qwen3) emit chain-of-thought that pollutes JSON/prose
        outputs. `reasoning_format` suppresses it, but it isn't a named argument
        in the Groq SDK — passing it directly raises TypeError — so it must ride
        in `extra_body` to reach the API. Only sent to Qwen so switching back to
        a non-reasoning model (Llama) won't 400."""
        params = dict(base)
        extra_body: dict[str, Any] = {}
        if self._reasoning_format and "qwen" in model.lower():
            extra_body["reasoning_format"] = self._reasoning_format
        if extra:
            for key, value in extra.items():
                if key == "extra_body" and isinstance(value, dict):
                    extra_body.update(value)
                else:
                    params[key] = value
        if extra_body:
            params["extra_body"] = extra_body
        return params

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
        effective_model = model or self._default_model
        params = self._build_params(
            effective_model,
            {
                "model": effective_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            extra,
        )
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
        effective_model = model or self._default_model
        params = self._build_params(
            effective_model,
            {
                "model": effective_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": True,
            },
            extra,
        )
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
    return GroqClient(
        api_key=s.GROQ_API_KEY,
        limiter=get_groq_rate_limiter(),
        default_model=s.LLM_MODEL,
        reasoning_format=s.GROQ_REASONING_FORMAT,
    )
