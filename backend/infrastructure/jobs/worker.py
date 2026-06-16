"""Background job worker.

Run as a separate process alongside the API when JOB_QUEUE_ENABLED=true:
    python -m infrastructure.jobs.worker

Keeping embedding/synthesis here (off the API process) means the API stays
light and these jobs survive on ephemeral/serverless API hosts. The worker is a
persistent process; size it for the embedding model's RAM (or use
EMBEDDING_PROVIDER=nomic to keep it small).

Runs ONE long-lived event loop for the worker's lifetime. This is required:
the Groq client + rate limiter are process singletons that bind asyncio state
(a background task, condition, async HTTP/redis clients) to the running loop, so
each job must share the same loop — not a fresh asyncio.run() per job.
"""
from __future__ import annotations

import asyncio
import json

from core.config import get_settings
from core.logging_config import configure_logging, get_logger
from infrastructure.jobs.queue import QUEUE_KEY
from infrastructure.jobs.tasks import HANDLERS


async def _process(raw: str) -> None:
    log = get_logger("jobs.worker")
    try:
        job = json.loads(raw)
    except Exception as exc:
        log.error("Dropping malformed job", error=str(exc))
        return
    handler = HANDLERS.get(job.get("type"))
    if handler is None:
        log.warning("No handler for job type", job_type=job.get("type"))
        return
    try:
        await handler(job.get("payload") or {})
    except Exception as exc:
        log.error("Job failed", job_type=job.get("type"), error=str(exc))


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    log = get_logger("jobs.worker")
    if not settings.REDIS_URL:
        raise SystemExit("REDIS_URL is required to run the job worker")

    import redis.asyncio as aioredis
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    log.info("Misir job worker started", queue=QUEUE_KEY)

    while True:
        try:
            popped = await r.brpop(QUEUE_KEY, timeout=5)
            if popped is None:
                continue
            _, raw = popped
            await _process(raw)
        except asyncio.CancelledError:
            break
        except Exception as exc:  # keep the loop alive on transient Redis errors
            log.error("Worker loop error", error=str(exc))
            await asyncio.sleep(0.5)


def run() -> None:
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
