"""Scaling: async DB offload, Groq shared-gate fail-open, remote embeddings, job queue."""
import httpx

from infrastructure.jobs.queue import enqueue
from infrastructure.services.db_async import aexec
from infrastructure.services.embedding_service import EmbeddingService
from infrastructure.services.groq_rate_limiter import GroqRateLimiter


async def test_aexec_runs_execute_off_thread():
    class Q:
        def execute(self):
            return "RESULT"
    assert await aexec(Q()) == "RESULT"


async def test_groq_gate_noop_without_redis():
    g = GroqRateLimiter(tpm=30000, rpm=30, redis_url=None)
    assert await g._shared_allows(100) is True  # single-instance: no gate


async def test_groq_gate_fails_open_when_redis_unavailable():
    g = GroqRateLimiter(tpm=30000, rpm=30, redis_url="redis://nonexistent:6379")
    # redis missing/unreachable must never block an LLM call
    assert await g._shared_allows(100) is True


def test_embedding_nomic_provider(monkeypatch):
    captured = {}

    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"embeddings": [[3.0, 4.0]]}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured.update(json or {})
        return _Resp()

    monkeypatch.setattr(httpx, "post", fake_post)
    svc = EmbeddingService(
        model_name="nomic-ai/nomic-embed-text-v1.5",
        provider="nomic", api_key="k", api_url="https://x",
    )
    r = svc.embed_text("hello")
    assert [round(x, 3) for x in r.vector] == [0.6, 0.8]   # L2-normalized like local
    assert r.dimension == 768
    assert captured["model"] == "nomic-embed-text-v1.5"    # bare id (no nomic-ai/)
    assert captured["task_type"] == "search_document"
    svc.embed_query("q")
    assert captured["task_type"] == "search_query"


def test_job_queue_enqueue_falls_back_when_disabled():
    # JOB_QUEUE_ENABLED defaults False → enqueue returns False (caller uses BackgroundTask)
    assert enqueue("post_capture", {"artifact_id": 1}) is False
