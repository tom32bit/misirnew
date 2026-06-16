"""Durable background-job queue (Redis list).

Lets the post-capture pipeline + gap embedding outlive the request that
triggered them — required on ephemeral/serverless hosts where FastAPI
BackgroundTasks are killed once the response is sent. Enqueue is a single sync
Redis LPUSH (safe to call from the sync `def` endpoints, which run in FastAPI's
threadpool). A separate worker (infrastructure.jobs.worker) BRPOPs and runs them.

Fail-safe: enqueue() returns False when the queue is disabled or Redis is
unavailable, so callers fall back to in-process BackgroundTasks.
"""
from __future__ import annotations

import json
from typing import Optional

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)

QUEUE_KEY = "misir:jobs"

_client = None
_init_failed = False


def _jobs_redis():
    """Lazy sync Redis client, or None when the queue is disabled/unavailable."""
    global _client, _init_failed
    if _init_failed:
        return None
    s = get_settings()
    if not s.JOB_QUEUE_ENABLED or not s.REDIS_URL:
        return None
    if _client is None:
        try:
            import redis as redis_sync
            _client = redis_sync.from_url(s.REDIS_URL, decode_responses=True)
        except Exception as exc:
            logger.warning("Job queue: redis init failed — using in-process fallback", error=str(exc))
            _init_failed = True
            return None
    return _client


def enqueue(job_type: str, payload: dict) -> bool:
    """Push a job. Returns False (→ caller falls back to in-process execution)
    when the queue is disabled or Redis errors."""
    r = _jobs_redis()
    if r is None:
        return False
    try:
        r.lpush(QUEUE_KEY, json.dumps({"type": job_type, "payload": payload}))
        return True
    except Exception as exc:
        logger.warning("Job enqueue failed — using in-process fallback", job_type=job_type, error=str(exc))
        return False
