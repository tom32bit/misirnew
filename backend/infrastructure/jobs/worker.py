"""Background job worker.

Run as a separate process alongside the API when JOB_QUEUE_ENABLED=true:
    python -m infrastructure.jobs.worker

Keeping embedding/synthesis here (off the API process) means the API stays
light and these jobs survive on ephemeral/serverless API hosts. The worker is a
persistent process; size it for the embedding model's RAM (or use
EMBEDDING_PROVIDER=nomic to keep it small).

Delivery semantics:
  * AT-LEAST-ONCE — jobs are moved (BRPOPLPUSH) to a processing list, and only
    removed after the handler finishes. On startup, anything stranded in the
    processing list (a previous crash mid-job) is requeued. This assumes a
    SINGLE worker process — with several, startup recovery would requeue
    another worker's in-flight jobs. Handlers are idempotent (embed/synthesize
    upsert by artifact id), so an occasional duplicate run is harmless.
  * DEAD-LETTER — a job whose handler raises is pushed to misir:jobs:dead
    (with the error) instead of being silently dropped; the list is capped.
  * CONCURRENCY — up to WORKER_CONCURRENCY jobs run at once, so a burst of
    captures doesn't serialize behind one slow LLM synthesis.

Runs ONE long-lived event loop for the worker's lifetime. This is required:
the Groq client + rate limiter are process singletons that bind asyncio state
(a background task, condition, async HTTP/redis clients) to the running loop, so
each job must share the same loop — not a fresh asyncio.run() per job.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from core.config import get_settings
from core.logging_config import configure_logging, get_logger
from infrastructure.jobs.queue import QUEUE_KEY
from infrastructure.jobs.tasks import HANDLERS

PROCESSING_KEY = f"{QUEUE_KEY}:processing"
DEAD_KEY = f"{QUEUE_KEY}:dead"
DEAD_LETTER_MAX = 1000          # keep the most recent N failures for inspection
WORKER_CONCURRENCY = 4


async def _dead_letter(r, raw: str, error: str) -> None:
    log = get_logger("jobs.worker")
    try:
        entry = json.dumps({
            "job": raw,
            "error": error,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        await r.lpush(DEAD_KEY, entry)
        await r.ltrim(DEAD_KEY, 0, DEAD_LETTER_MAX - 1)
        log.error("Job dead-lettered", key=DEAD_KEY, error=error)
    except Exception as exc:
        log.error("Dead-letter push failed — job lost", error=str(exc), job=raw[:200])


async def _process(r, raw: str) -> None:
    log = get_logger("jobs.worker")
    try:
        job = json.loads(raw)
    except Exception as exc:
        await _dead_letter(r, raw, f"malformed json: {exc}")
        return
    handler = HANDLERS.get(job.get("type"))
    if handler is None:
        await _dead_letter(r, raw, f"no handler for job type {job.get('type')!r}")
        return
    try:
        await handler(job.get("payload") or {})
    except Exception as exc:
        await _dead_letter(r, raw, str(exc))


async def _run_one(r, raw: str, sem: asyncio.Semaphore) -> None:
    """Process one job, then ack (remove from the processing list)."""
    try:
        await _process(r, raw)
    finally:
        try:
            await r.lrem(PROCESSING_KEY, 1, raw)
        except Exception as exc:
            get_logger("jobs.worker").warning("Job ack failed (will requeue on restart)", error=str(exc))
        sem.release()


async def _recover_stranded(r) -> int:
    """Requeue jobs left in the processing list by a previous crash."""
    count = 0
    while True:
        item = await r.rpoplpush(PROCESSING_KEY, QUEUE_KEY)
        if item is None:
            return count
        count += 1


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    log = get_logger("jobs.worker")
    if not settings.REDIS_URL:
        raise SystemExit("REDIS_URL is required to run the job worker")

    import redis.asyncio as aioredis
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    recovered = await _recover_stranded(r)
    if recovered:
        log.warning("Requeued stranded in-flight jobs from previous run", count=recovered)
    log.info("Misir job worker started", queue=QUEUE_KEY, concurrency=WORKER_CONCURRENCY)

    sem = asyncio.Semaphore(WORKER_CONCURRENCY)
    tasks: set[asyncio.Task] = set()
    try:
        while True:
            try:
                await sem.acquire()
                try:
                    raw = await r.brpoplpush(QUEUE_KEY, PROCESSING_KEY, timeout=5)
                except BaseException:
                    sem.release()
                    raise
                if raw is None:
                    sem.release()
                    continue
                task = asyncio.create_task(_run_one(r, raw, sem))
                tasks.add(task)
                task.add_done_callback(tasks.discard)
            except asyncio.CancelledError:
                break
            except Exception as exc:  # keep the loop alive on transient Redis errors
                log.error("Worker loop error", error=str(exc))
                await asyncio.sleep(0.5)
    finally:
        if tasks:
            log.info("Draining in-flight jobs", count=len(tasks))
            await asyncio.gather(*tasks, return_exceptions=True)


def run() -> None:
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
