"""
Groq API rate limiter — shared token-bucket + priority queue.
Carried over from v1 unchanged.
"""
from __future__ import annotations

import asyncio
import heapq
import time
from dataclasses import dataclass, field
from enum import IntEnum
from functools import lru_cache
from typing import Optional

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)

# Atomic check-and-consume against a per-minute fixed window shared across all
# backend instances. Returns 1 if the request fit within the global RPM+TPM caps
# (and consumes), else 0. Keeps the account-wide Groq quota from being exceeded
# when running >1 instance (the in-process bucket only smooths within one).
_GROQ_GATE_LUA = """
local rpm = tonumber(redis.call('GET', KEYS[1]) or '0')
local tpm = tonumber(redis.call('GET', KEYS[2]) or '0')
if rpm + 1 > tonumber(ARGV[1]) then return 0 end
if tpm + tonumber(ARGV[3]) > tonumber(ARGV[2]) then return 0 end
redis.call('INCRBY', KEYS[1], 1)
redis.call('INCRBY', KEYS[2], tonumber(ARGV[3]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
return 1
"""


class TaskPriority(IntEnum):
    CHAT = 0
    SYNTHESIS = 1
    INSIGHT = 2


class GroqRateLimitError(Exception):
    pass


@dataclass(order=True)
class _PendingRequest:
    priority: int
    seq: int
    tokens_estimate: int = field(compare=False)
    future: asyncio.Future = field(compare=False)


class GroqRateLimiter:
    def __init__(self, tpm: int, rpm: int, max_wait_s: float = 30.0, redis_url: Optional[str] = None) -> None:
        if tpm <= 0 or rpm <= 0:
            raise ValueError("tpm and rpm must be positive")
        self._tpm = tpm
        self._rpm = rpm
        self._max_wait_s = max_wait_s
        # Optional shared cross-instance gate (None => single-instance, no gate).
        self._redis_url = redis_url or None
        self._redis = None
        self._token_refill_per_s = tpm / 60.0
        self._req_refill_per_s = rpm / 60.0
        self._tokens = float(tpm)
        self._reqs = float(rpm)
        self._last_refill_ts: Optional[float] = None
        self._heap: list[_PendingRequest] = []
        self._seq = 0
        self._cond = asyncio.Condition()
        self._worker: Optional[asyncio.Task] = None

    async def acquire(self, tokens_estimate: int, priority: int = TaskPriority.SYNTHESIS) -> None:
        if tokens_estimate <= 0:
            tokens_estimate = 1
        if tokens_estimate > self._tpm:
            tokens_estimate = self._tpm
        self._ensure_worker()
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        async with self._cond:
            self._seq += 1
            heapq.heappush(self._heap, _PendingRequest(priority=int(priority), seq=self._seq, tokens_estimate=tokens_estimate, future=fut))
            self._cond.notify_all()
        try:
            await asyncio.wait_for(fut, timeout=self._max_wait_s)
        except asyncio.TimeoutError:
            if not fut.done():
                fut.cancel()
            raise GroqRateLimitError(f"Rate limit saturated — waited {self._max_wait_s}s")

    def record_actual_usage(self, actual_tokens: int, estimated: int) -> None:
        delta = actual_tokens - estimated
        if delta != 0:
            self._tokens = max(0.0, min(float(self._tpm), self._tokens - delta))

    def _get_redis(self):
        if not self._redis_url:
            return None
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
            except Exception as exc:
                logger.warning("Groq shared gate: redis init failed — failing open", error=str(exc))
                self._redis_url = None  # don't retry every dispatch
                return None
        return self._redis

    async def _shared_allows(self, tokens: int) -> bool:
        """Atomically reserve global quota across instances. Fails OPEN: a Redis
        error never blocks an LLM call (degrades to single-instance behaviour)."""
        r = self._get_redis()
        if r is None:
            return True
        try:
            minute = int(time.time() // 60)
            res = await r.eval(
                _GROQ_GATE_LUA, 2,
                f"groq:rpm:{minute}", f"groq:tpm:{minute}",
                self._rpm, self._tpm, int(tokens), 120,
            )
            return int(res) == 1
        except Exception as exc:
            logger.warning("Groq shared gate error — failing open", error=str(exc))
            return True

    def _ensure_worker(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.create_task(self._run(), name="groq-rate-limiter-worker")

    async def _run(self) -> None:
        while True:
            try:
                wait = await self._dispatch_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("groq rate limiter worker error: %s", exc)
                await asyncio.sleep(0.1)
                continue
            if wait is None:
                async with self._cond:
                    while not self._heap:
                        await self._cond.wait()
            elif wait > 0:
                try:
                    async with self._cond:
                        await asyncio.wait_for(self._cond.wait(), timeout=wait)
                except asyncio.TimeoutError:
                    pass

    async def _dispatch_once(self) -> Optional[float]:
        async with self._cond:
            while self._heap and self._heap[0].future.cancelled():
                heapq.heappop(self._heap)
            if not self._heap:
                return None
            head = self._heap[0]
            self._refill()
            if self._tokens >= head.tokens_estimate and self._reqs >= 1:
                # Local bucket would grant — also reserve from the shared
                # cross-instance gate (no-op/allow when Redis is not configured).
                if not await self._shared_allows(head.tokens_estimate):
                    # Global quota saturated — re-poll shortly (other instances
                    # may free quota or the window may reset).
                    return min(1.0, self._max_wait_s)
                heapq.heappop(self._heap)
                self._tokens -= head.tokens_estimate
                self._reqs -= 1
                if not head.future.done():
                    head.future.set_result(None)
                return 0.0
            token_deficit = head.tokens_estimate - self._tokens
            req_deficit = 1 - self._reqs
            wait_t = token_deficit / self._token_refill_per_s if token_deficit > 0 else 0.0
            wait_r = req_deficit / self._req_refill_per_s if req_deficit > 0 else 0.0
            return max(wait_t, wait_r, 0.05)

    def _refill(self) -> None:
        now = time.monotonic()
        if self._last_refill_ts is None:
            self._last_refill_ts = now
            return
        elapsed = now - self._last_refill_ts
        if elapsed <= 0:
            return
        self._tokens = min(float(self._tpm), self._tokens + elapsed * self._token_refill_per_s)
        self._reqs = min(float(self._rpm), self._reqs + elapsed * self._req_refill_per_s)
        self._last_refill_ts = now


@lru_cache(maxsize=1)
def get_groq_rate_limiter() -> GroqRateLimiter:
    s = get_settings()
    redis_url = s.REDIS_URL if s.RATE_LIMIT_STORAGE == "redis" else None
    return GroqRateLimiter(
        tpm=s.GROQ_TPM_LIMIT, rpm=s.GROQ_RPM_LIMIT,
        max_wait_s=s.GROQ_MAX_WAIT_SECONDS, redis_url=redis_url,
    )
