"""
Embedding service — fixed 768d, no Matryoshka branching.
Model: nomic-ai/nomic-embed-text-v1.5 with search_document / search_query prefix.

Two providers (EMBEDDING_PROVIDER):
  - 'local'  : load the torch model in-process (default; ~1-1.5GB RAM).
  - 'nomic'  : call Nomic's hosted API — SAME model + 768 dims, so no DB
               re-embedding is needed — letting the backend run on small-RAM
               hosts with no cold-start model reload. Requires NOMIC_API_KEY.
"""
from __future__ import annotations

import hashlib
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import numpy as np

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)

DIM = 768


@dataclass(frozen=True)
class EmbeddingResult:
    vector: list[float]
    dimension: int
    model: str
    text_hash: str


class EmbeddingService:
    DEFAULT_MODEL = "nomic-ai/nomic-embed-text-v1.5"

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        provider: str = "local",
        api_key: str = "",
        api_url: str = "",
    ) -> None:
        self._model_name = model_name
        self._provider = (provider or "local").lower()
        self._api_key = api_key
        self._api_url = api_url
        self._model_lock = threading.Lock()
        self._model_instance = None
        self._loaded = False
        if self._provider == "nomic" and not api_key:
            logger.warning("EMBEDDING_PROVIDER=nomic but NOMIC_API_KEY is empty — embeds will fail")

    @property
    def is_loaded(self) -> bool:
        # Remote provider has nothing to load; report ready.
        return self._loaded or self._provider != "local"

    # ── Local (torch) ─────────────────────────────────────────────────────────
    def _load_model(self):
        if self._model_instance is None:
            with self._model_lock:
                if self._model_instance is None:
                    logger.info("Loading embedding model", model=self._model_name)
                    from sentence_transformers import SentenceTransformer
                    self._model_instance = SentenceTransformer(self._model_name, trust_remote_code=True)
                    self._loaded = True
                    logger.info("Embedding model loaded")
        return self._model_instance

    @property
    def _model(self):
        return self._load_model()

    @lru_cache(maxsize=10000)
    def _cached_encode_local(self, prefixed_text: str) -> np.ndarray:
        return self._model.encode(prefixed_text, normalize_embeddings=True, show_progress_bar=False)

    # ── Remote (Nomic hosted API) ───────────────────────────────────────────────
    def _remote_model_id(self) -> str:
        # Nomic API expects the bare id, e.g. 'nomic-embed-text-v1.5'.
        return self._model_name.split("/")[-1]

    def _remote_encode(self, texts: list[str], task_type: str) -> list[list[float]]:
        import httpx
        resp = httpx.post(
            self._api_url,
            headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
            json={"model": self._remote_model_id(), "texts": texts, "task_type": task_type},
            timeout=30,
        )
        resp.raise_for_status()
        embeddings = resp.json().get("embeddings") or []
        out: list[list[float]] = []
        for emb in embeddings:
            vec = np.asarray(emb, dtype=float)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm  # match local normalize_embeddings=True
            out.append(vec.tolist())
        return out

    @lru_cache(maxsize=10000)
    def _cached_encode_remote(self, text: str, task_type: str) -> tuple:
        return tuple(self._remote_encode([text], task_type)[0])

    # ── Public API (provider-agnostic) ──────────────────────────────────────────
    def _hash(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()[:16]

    def _embed_one(self, text: str, task_type: str) -> list[float]:
        if self._provider == "nomic":
            return list(self._cached_encode_remote(text, task_type))
        prefix = "search_query: " if task_type == "search_query" else "search_document: "
        return self._cached_encode_local(f"{prefix}{text}").tolist()

    def embed_text(self, text: str) -> EmbeddingResult:
        return EmbeddingResult(
            vector=self._embed_one(text, "search_document"),
            dimension=DIM, model=self._model_name, text_hash=self._hash(text),
        )

    def embed_query(self, query: str) -> EmbeddingResult:
        return EmbeddingResult(
            vector=self._embed_one(query, "search_query"),
            dimension=DIM, model=self._model_name, text_hash=self._hash(query),
        )

    def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        if self._provider == "nomic":
            vecs = self._remote_encode(list(texts), "search_document")
        else:
            prefixed = [f"search_document: {t}" for t in texts]
            raw = self._model.encode(prefixed, normalize_embeddings=True, show_progress_bar=False, batch_size=32)
            vecs = [v.tolist() for v in raw]
        return [
            EmbeddingResult(vector=vec, dimension=DIM, model=self._model_name, text_hash=self._hash(t))
            for t, vec in zip(texts, vecs)
        ]


_service: Optional[EmbeddingService] = None
_lock = threading.Lock()


def get_embedding_service() -> EmbeddingService:
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                s = get_settings()
                _service = EmbeddingService(
                    model_name=s.EMBEDDING_MODEL,
                    provider=s.EMBEDDING_PROVIDER,
                    api_key=s.NOMIC_API_KEY,
                    api_url=s.NOMIC_EMBED_URL,
                )
    return _service
