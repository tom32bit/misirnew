# Misir

**Decision-readiness for founders and operators.** Misir captures the research you actually engage with — articles, AI-chat threads, PDFs — organises it into *spaces*, and tells you when you have enough signal to act.

> **Proprietary and confidential.** © 2026 Misir. All rights reserved. See [LICENSE](LICENSE). Access does not grant a license.

---

## Contents

- [What's in this repo](#whats-in-this-repo)
- [How it fits together](#how-it-fits-together)
- [Quickstart](#quickstart)
- [CI](#ci)
- [Documentation](#documentation)
- [Conventions that matter](#conventions-that-matter)
- [Third-Party Notices](#third-party-notices)

---

## What's in this repo

| Directory | What it is |
|-----------|------------|
| [`backend/`](backend/) | **FastAPI** (Python 3.12) — API, LLM synthesis pipeline, embeddings, deterministic scoring. Supabase (Postgres + pgvector). |
| [`frontend/`](frontend/) | **Next.js 16 / React 19** dashboard — the app users log into. Clerk auth, TanStack Query. |
| [`extension-v2/`](extension-v2/) | **Chrome MV3** capture extension (v2.0.0) — captures web pages and AI-chat conversations, and runs embeddings **on-device**. |

## How it fits together

```
Chrome Extension (extension-v2)
  ├─ Captures pages + AI-chat threads across 9 AI platforms
  ├─ Extracts (Readability) and analyses (wink-nlp) locally
  ├─ Embeds ON-DEVICE — Nomic 768d via transformers.js in an offscreen doc
  ├─ Picks space/subspace locally (hybrid semantic + lexical matching)
  └─ Redacts PII, then syncs (Dexie → Supabase)
        │  REST + Bearer JWT
        ▼
FastAPI Backend (backend)
  ├─ Two-stage LLM synthesis (Groq / Llama-4) — artifact → space → report
  ├─ Deterministic confidence + readiness math (never the LLM)
  ├─ Embeddings + cross-space linking (pgvector cosine)
  └─ Supabase (Postgres + pgvector)
        ▲
        │  REST (ky) + Bearer JWT
Next.js Dashboard (frontend)
  └─ Home · Inbox · Collection · Comparison · Decision · Chat (SSE)
```

Auth is **Clerk** across all three. Storage is **Supabase**; the backend uses the service-role key and is the trust boundary.

## Quickstart

**Prerequisites:** Python 3.12, Node 20, and access to Supabase, Clerk, and Groq credentials.

### Backend

```bash
cd backend
python -m venv .venv               # must be Python 3.12 — torch ships no 3.13+ wheels
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-local-embeddings.txt   # see EMBEDDING_PROVIDER below
cp .env.example .env               # then fill it in — see below
uvicorn main:app --port 8000
```

`EMBEDDING_PROVIDER` defaults to `local`, which runs the model in-process and
needs the torch stack — hence `requirements-local-embeddings.txt` above. Set
`EMBEDDING_PROVIDER=nomic` (+ `NOMIC_API_KEY`) if you would rather call the
hosted API, and `pip install -r requirements.txt` alone is enough.

> **`--reload` is off by default here on purpose.** Uvicorn's reloader respawns
> its child with the *base* interpreter on some setups, not the venv's. The child
> then dies on import while still holding port 8000 — and because it never
> listens, the port looks free to `netstat` while every restart fails to bind.
> If you enable it, launch from an activated venv and check `python -c "import
> sys; print(sys.executable)"` resolves inside `.venv` first.

Required env (full list in [`backend/.env.example`](backend/.env.example)):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Database (service-role key — never the anon key) |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | JWT verification |
| `GROQ_API_KEY` | LLM (synthesis, chat, nudges, space generation) |
| `EMBEDDING_PROVIDER` | `local` (in-process torch, ~1–1.5 GB RAM) or `nomic` (hosted API) |

### Frontend

```bash
cd frontend
npm ci
npm run dev                        # http://localhost:3000
```

### Extension

```bash
cd extension-v2
npm ci                             # postinstall copies the onnxruntime wasm
npm run dev                        # or: npm run build
```

Then load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension-v2/dist`.

Defaults point at `http://localhost:8000` (backend) and `http://localhost:3000` (Clerk sync host); override with `VITE_BACKEND_URL` / `VITE_CLERK_SYNC_HOST`.

> On first run the extension downloads the ~140 MB embedding model from the Hugging Face hub and caches it in the browser.

### Tests

```bash
cd backend       && python -m pytest -q
cd extension-v2  && npm test        # fast, offline (mocked embeddings)
cd extension-v2  && npm run eval    # model-backed matching eval (~90 MB download)
```

Run `npm run eval` whenever you touch matching — it is deliberately **not** a CI gate.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on push to `main` and on every PR:

| Job | What it gates |
|-----|---------------|
| **Backend** | `pytest` |
| **Frontend** | `eslint` + `next build`, which type-checks the project — both **blocking** |
| **Extension** | `vitest` + `npm run build`, which runs `tsc` first — type-checking **blocks** |

> Modifying `.github/workflows/**` requires a token with the `workflow` scope.

## Documentation

| Doc | Read it for |
|-----|-------------|
| [Misir.md](Misir.md) | Full codebase documentation — architecture, directory map, DB schema, API reference, algorithms |
| [Misir-AI-Usage.md](Misir-AI-Usage.md) | Why and how AI is used: the AI/deterministic split, the ten AI touchpoints, cost and safety controls |

## Conventions that matter

These are load-bearing. Breaking them breaks the product's guarantees.

1. **LLMs never output numbers.** Every percentage a user sees — confidence, readiness, coverage — comes from `confidence_service.py`. This is enforced in the prompts, in Pydantic schemas, and by keeping the math in a separate service. A hallucinated sentence is recoverable; a hallucinated *metric* gets acted on.
2. **Every synthesised finding must cite its evidence.** Findings that can't cite a supporting artifact are dropped, not shown.
3. **Deterministic first; the LLM last and rarely.** Capture, matching, scoring, and nudge *triggering* are deterministic. The LLM is gated by engagement, capped by top-K, cached by content hash, and always has a deterministic fallback — it degrades the product, never breaks it.
4. **Local-first.** Extraction, NLP, embedding, matching, and PII redaction all happen in the browser. A page is understood before it is uploaded.
5. **The client and server share one embedding contract, byte-for-byte.** `extension-v2/src/lib/embedder.ts` mirrors `backend/infrastructure/services/embedding_service.py` — same model, dims, prefixes, normalisation — so their vectors are comparable. Change one, change both.
6. **Matching prefers precision over recall.** A page that's ambiguous on both semantic and lexical signals is left unmatched rather than force-fit. Thresholds in `matching.ts` are tuned against the eval corpus and carry their rationale in comments — read them before tuning.

## Third-Party Notices

The Software incorporates third-party components that remain the property of their respective owners and are governed by their own licenses. This list is a good-faith engineering summary, **not** a legal clearance.

**Services (data leaves the system):**

| Service | Used for |
|---------|----------|
| **Groq** (`meta-llama/llama-4-scout-17b-16e-instruct`) | All LLM generation — artifact text is sent for synthesis |
| **Nomic** | Hosted embeddings, when `EMBEDDING_PROVIDER=nomic` |
| **Hugging Face hub** | The extension fetches embedding-model weights on first use |
| **Supabase**, **Clerk** | Database and authentication |

**Models:** `nomic-ai/nomic-embed-text-v1.5` — subject to its own model license.

**Fonts** shipped from `frontend/public/fonts/`:

| Font | Note |
|------|------|
| **Fira Code** | SIL Open Font License 1.1 |
| **Copernicus**, **Styrene B** | ⚠️ Proprietary typefaces associated with **Anthropic**'s brand; not under an open font license |
| **Tiempos Text** | ⚠️ Commercial typeface of the **Klim Type Foundry**; requires a paid license for distribution |

> ⚠️ The fonts marked above are **not** open-licensed. Shipping them in a distributed bundle (the frontend serves them from `public/fonts/`) requires a license from the respective rights holder. This is **flagged, not cleared** — route it to the legal team.

**Open-source dependencies** are declared in `backend/requirements.txt`, `frontend/package.json`, and `extension-v2/package.json`; their licenses govern their use.

> Legal and privacy compliance is owned by a **separate team** and tracked outside this repo. Route licensing, sub-processor, DPA, and font questions there.
