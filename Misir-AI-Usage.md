# Why & How We Use AI in Misir

*Status: living document · Audience: engineering, product, founders, reviewers, and anyone evaluating Misir's AI posture · Last grounded against code: 2026-07-15*

---

## 0. TL;DR

Misir uses AI for exactly one job: **turning a pile of things you read into a small number of things you should think about.** It is a *synthesis layer*, not a data source.

Three principles govern every AI decision in the codebase:

1. **AI summarizes; it never measures.** Every number a user sees (confidence %, readiness %, research depth) is computed deterministically in code. LLMs are explicitly forbidden — in their own system prompts — from emitting numbers.
2. **Every claim must be traceable.** Synthesis outputs must cite the artifacts they came from. Findings that can't cite evidence are dropped, not shown.
3. **AI is the expensive path, so it runs last and rarely.** Capture, matching, and scoring are deterministic and local. The LLM is gated by engagement, cached by content hash, rate-limited, and always has a deterministic fallback.

---

## 1. Why AI at all

Misir's user is a founder (or any deep researcher) drowning in tabs, chats, and articles across nine AI platforms and the open web. The problem is **not** retrieval — search already solves that. The problem is **synthesis under their own goal**: *"Given everything I've actually engaged with this week, what matters, what's contradictory, and what am I missing?"*

That question has three properties that make it a genuine AI problem and not a database query:

- **It's open-vocabulary.** Themes, tensions, and blind spots aren't columns you can `GROUP BY`.
- **It's goal-relative.** The same article means different things depending on the space's stated goal.
- **It's compressive.** The output must be *shorter and sharper* than the input, in natural language a human will actually read.

So AI earns its place precisely where deterministic code can't go: **reading unstructured content and re-expressing it as structured, goal-aware insight.** Everywhere else, we deliberately keep AI *out*.

### Why we keep AI *out* of most things

| Job | How it's done | Why **not** AI |
|---|---|---|
| Deciding what page belongs to which space | Hybrid semantic+lexical matching, **on-device** (`lib/matching.ts` + `embedder.ts`) | Embeddings + tuned thresholds, no generation — deterministic, offline, auditable, and no upload |
| Extracting clean text from a web page | `@mozilla/readability` + `wink-nlp` | Runs client-side, no token cost, no privacy exposure |
| Every percentage/score in the UI | `confidence_service.py` (weighted blend) | Numbers must be reproducible and explainable, not vibes |
| Cross-space relevance | pgvector cosine similarity over embeddings | Math, not generation — cheap and exact |
| When to nudge the user | Deterministic rules (`nudge_engine.py`) | Triggering logic must be predictable; only the *phrasing* is AI |

This table is the real thesis of the document: **AI is a scalpel, not a hammer.** The interesting engineering in Misir is the discipline about where AI is *not* allowed.

---

## 2. The hard rule: LLMs never output numbers

This is the single most load-bearing convention in the backend, and it is enforced in three places at once:

1. **In the prompts.** Every synthesis system prompt contains an explicit instruction, e.g.:
   > *"Do NOT output any numbers, percentages, ratios, or counts."* — `ARTIFACT_SYNTHESIS_SYSTEM`, [synthesis_service.py](backend/infrastructure/services/synthesis_service.py)
2. **In the schema.** LLM JSON is validated by Pydantic models (`ArtifactSynthesisOutput`, `StageAOutput`, `StageBComparison`, `StageBDecision`). Numeric fields that *do* exist (e.g. `coverage`, `readiness`) are commented as *"from confidence_service, NOT from LLM."*
3. **In a separate service.** All numbers come from [confidence_service.py](backend/infrastructure/services/confidence_service.py), which is pure deterministic math.

**Why this matters so much:** a hallucinated sentence is recoverable — the user reads it critically. A hallucinated *number* ("87% ready to raise") looks authoritative and gets acted on. By construction, Misir cannot produce one. Theme confidence, for example, is a fixed weighted blend:

```
confidence = round(100 × clamp01(
      0.40 × evidence_strength      # # supporting artifacts, capped at 5
    + 0.25 × engagement_quality     # avg engagement multiplier
    + 0.20 × recency_score          # exp decay, RECENCY_LAMBDA
    + 0.15 × source_diversity       # distinct platforms
))
```

Same inputs → same number, every time, with a one-line explanation. That's the opposite of an LLM.

---

## 3. The AI stack

| Layer | Technology | Where | Notes |
|---|---|---|---|
| **Generation (LLM)** | **Groq** — `meta-llama/llama-4-scout-17b-16e-instruct` | Backend, all synthesis/chat/nudge/generation | Default `temperature=0.3` for synthesis (determinism-leaning), `0.7` for chat. `max_tokens=1024` default. Single client: [groq_client.py](backend/infrastructure/services/groq_client.py) |
| **Embeddings (server)** | `nomic-ai/nomic-embed-text-v1.5`, 768-dim | Backend | `local` (in-process torch) or `nomic` (hosted API) — same model + dims either way, so no DB migration. [embedding_service.py](backend/infrastructure/services/embedding_service.py) |
| **Embeddings (client)** | **same** Nomic model, 768-dim, q8-quantized (~140 MB) | **Extension, on-device** | transformers.js + onnxruntime-web (WASM) in an **offscreen document**. Contract mirrors the backend byte-for-byte, so client and server vectors are comparable. [embedder.ts](extension-v2/src/lib/embedder.ts) |
| **Vector search** | pgvector (Postgres) | DB | Cross-space linking, content similarity |
| **Client-side NLP** | `wink-nlp` + `@mozilla/readability` | Extension | Keyword/entity extraction, content cleaning — *no LLM, no network* |

**Why Groq + Llama-4-Scout:** the synthesis workload is high-volume, latency-sensitive, and structured-JSON. Groq's inference speed and the model's instruction-following on JSON schemas fit a free/low-cost tier, which is a hard product constraint. All calls funnel through **one** `GroqClient` so rate-limiting, token accounting, and priority are enforced globally — there is no second path to the LLM.

**Why a single shared LLM entry point:** every call passes through `chat_completion` / `chat_completion_stream`, which (a) estimate prompt tokens, (b) `acquire()` from the rate limiter with a `TaskPriority`, and (c) record actual usage afterward. This makes the LLM a *metered utility*, not a thing any service can call ad hoc.

---

## 4. Where AI shows up (the surfaces)

There are **ten** distinct AI touchpoints. Five are LLM, three are embeddings/vector math (one now **on-device**), two are client-side NLP. Here they are in pipeline order.

### 4.1 Capture-time content extraction — *client-side NLP, no LLM*
**Where:** [extension-v2/src/lib/nlp.ts](extension-v2/src/lib/nlp.ts), `content/web-capture.ts`
**What:** When you read a page, the extension uses Readability to strip boilerplate and `wink-nlp` to lemmatize content words and pull entities. **Why local:** it's free, instant, works offline, and — critically — page content never leaves your machine just to be tokenized. This feeds the **keyword pre-gate** of the on-device matcher (§4.2b), *not* an LLM.

### 4.2 AI-chat conversation capture — *adapters, no LLM*
**Where:** [extension-v2/src/content/platform-detector.ts](extension-v2/src/content/platform-detector.ts), [content/extractors/](extension-v2/src/content/extractors/) (9 extractors + `base.ts`: chatgpt, claude, copilot, deepseek, gemini, grok, kimi, notebooklm, perplexity)
**What:** Misir captures *your conversations with other AIs* as first-class research artifacts. Each adapter knows how to read a given platform's DOM/context. **Why it matters for AI strategy:** AI-chat artifacts **bypass the engagement gate** — if you bothered to ask an AI about it, it's signal by definition.

### 4.2b On-device embeddings + hybrid matching — *vector math in your browser, no LLM, no upload*
**Where:** [embedder.ts](extension-v2/src/lib/embedder.ts), [matching.ts](extension-v2/src/lib/matching.ts), `offscreen/`
**What:** The extension runs the **same Nomic model as the backend** (768d, q8-quantized ~140 MB) locally via transformers.js + onnxruntime-web, inside an **offscreen document** (a service worker can't do WASM inference at that size). It embeds the page and picks the space/subspace on-device with a hybrid scheme: keyword **pre-gate** → **space by semantic score only** (`SEMANTIC_FLOOR=0.60`, `SPACE_MARGIN=0.07`) → lexical tie-break for adjacent spaces → **subspace at 0.75 semantic / 0.25 keyword**. Ambiguous pages are deliberately left **unmatched** — precision over recall.
**Why this matters:** (1) **Privacy** — a page can be *understood* semantically without being uploaded. (2) **Comparability** — the client contract mirrors [embedding_service.py](backend/infrastructure/services/embedding_service.py) byte-for-byte (model, dims, `search_query:`/`search_document:` prefixes, mean-pool + L2-norm), so client and server vectors live in the same space. (3) **Cost** — the pre-gate skips the expensive embed entirely for pages that match nothing.
**Tuned against real data, not vibes:** thresholds come from the eval harness in [extension-v2/eval/](extension-v2/eval/) (`npm run eval`), and the constants carry their rationale in comments — read them before tuning. A **correction feedback loop** promotes user-corrected terms into low-weight `learned` markers, which is exactly why keyword retains weight at the subspace stage.

### 4.3 Per-artifact synthesis — *LLM (Stage 0)*
**Where:** `synthesize_artifact_text()` in [synthesis_service.py](backend/infrastructure/services/synthesis_service.py)
**What:** For each qualifying artifact, one Groq call extracts `{top_insight, themes[], unique_signal}` as validated JSON, stored in `source_synthesis`. **Goal-aware:** the space's `goal` is injected into the prompt so "most actionable finding" is relative to *your* objective. **Gated:** only runs above `SYNTHESIS_MIN_ENGAGEMENT` (default `passive`) — see §5.

### 4.4 Stage A — per-space summary — *LLM*
**Where:** `run_stage_a()` in [synthesis_service.py](backend/infrastructure/services/synthesis_service.py)
**What:** Aggregates the top-K artifacts (K = 15/25/40 for today/week/month, ranked by `base_weight`) plus open gaps into a `space_summary`: `{headline, key_findings[], open_questions[], patterns[], top_platforms[]}`.
**The grounding mechanism that makes this trustworthy:**
- Every `key_finding` **must** cite ≥1 `supporting_artifact_id`.
- If >20% of findings are uncited, the code **re-prompts the model once** ("remove any finding you can't cite") before accepting output.
- If the LLM fails twice, a **deterministic fallback** (`_stage_a_fallback`) stitches a summary from gaps + platform counts — the product never hard-fails on an LLM error.

### 4.5 Stage B — dashboard reports — *LLM*
**Where:** report handler, consuming Stage A; report *kinds*: `misir_read`, `comparison`, `synthesis`, `decision`.
**What:** Turns the per-space summary into the actual dashboard payloads the user reads — e.g. a `comparison` view (`sources`, `key_tension`, `synthesis{consensus, conflict, blindspot, readiness}`) or a `decision` view (`raise_now{pros,cons}`, `extend_runway{pros,cons}`, `readiness`). Numeric fields like `readiness`/`coverage` are **filled by `confidence_service`, not the model.** Cached by `source_hash` per kind × period.

### 4.6 Deterministic confidence — *the counterweight, no LLM*
**Where:** [confidence_service.py](backend/infrastructure/services/confidence_service.py). Covered in §2. This is listed as an "AI surface" precisely because its job is to be the *non-AI* half of every AI output.

### 4.7 Server embeddings + cross-space linking — *vector math, no generation*
**Where:** [embedding_service.py](backend/infrastructure/services/embedding_service.py), [cross_space_linker.py](backend/infrastructure/services/cross_space_linker.py) (the client-side counterpart is §4.2b)
**What:** At capture time, the new artifact's embedding is compared (cosine) against every *open gap's* embedding across *all* the user's spaces. If similarity ≥ `CROSS_SPACE_SIMILARITY_THRESHOLD` (0.72) **and** the gap is in a different space → a `cross_space_link` is created ("the thing you read for Space X actually answers an open question in Space Y"). This is one of Misir's most magical features and it uses **zero generation** — just embeddings and a dot product.

### 4.8 Nudge engine — *deterministic rules + LLM phrasing only*
**Where:** [nudge_engine.py](backend/infrastructure/services/nudge_engine.py)
**What:** Four **deterministic** rules decide *whether* to nudge (revisit-without-resolve, recurring-gap, cross-space-untaken, deadline-pressure). **Only after** a rule fires does a single Groq call phrase it in Misir's voice as `{scatter, direction, consequence}` — strict second-person, imperative, no invented business/funding framing. **Why split this way:** *when* to interrupt a user is a product-safety decision that must be predictable; only the *wording* benefits from AI.

### 4.9 AI space generation — *LLM bootstrap*
**Where:** [space_generator.py](backend/infrastructure/services/space_generator.py)
**What:** When you create a space from a name + intention, Groq generates 4–7 subspaces, each with 5–10 concrete lowercase **marker phrases** (weighted 0.4–1.0). **Why it exists:** markers drive the extension's lexical matcher — *a space with zero markers matches nothing* — and humans hate writing them by hand. On any failure it returns `None` and the API still creates the bare space, so the user is never blocked.

### 4.10 Chat — *LLM, streamed*
**Where:** [chat_handler.py](backend/application/handlers/chat_handler.py)
**What:** A grounded research assistant. `_build_context()` assembles the user's spaces, recent artifacts, and gaps into the prompt; the response is **streamed** (`chat_completion_stream`, `temperature=0.7`) under the `CHAT` priority and a tighter `20/minute` rate limit. The system prompt instructs it to cite specific evidence (artifact title, gap label, platform).

---

## 5. How we keep AI cheap, safe, and controllable

Misir is built to run on free/low tiers, so cost control *is* a correctness requirement. Five mechanisms, all in code:

1. **Engagement gate.** Per-artifact LLM extraction only runs above `SYNTHESIS_MIN_ENGAGEMENT` (default `passive`). A page you glanced at for two seconds never costs a token. (AI-chat artifacts bypass this — see §4.2.)
2. **Top-K caps.** Stage A only ever feeds the LLM the K most-weighted artifacts (15/25/40), never the whole corpus. Cost is bounded regardless of how much you read.
3. **Content-hash caching.** Stage A and Stage B are cached by a `source_hash` (sha256 of sorted artifact IDs + content hashes + gap IDs). If nothing you read changed, **no LLM call happens at all** — the dashboard is served from cache.
4. **Global rate limiting + priority.** Every call goes through `groq_rate_limiter` with a `TaskPriority` (TPM 30k / RPM 30 by default), with per-endpoint limits on top (chat `20/min`, generation/regeneration `10/min`). Token usage is estimated before and reconciled after each call.
5. **Deterministic fallbacks everywhere.** Stage A failure → `_stage_a_fallback`. Space generation failure → bare space. Groq not configured (`is_available == False`) → services return `None` gracefully. **The LLM being down degrades the product; it never breaks it.**

Together these mean the *expensive, non-deterministic* part of the system runs as infrequently as correctness allows, and its failure is always absorbed.

---

## 6. Privacy & governance posture for AI

AI sees content, so it sits inside the privacy boundary:

- **Local-first, and increasingly so.** Content extraction, NLP (§4.1), **embedding, and space/subspace matching (§4.2b)** all happen in-browser. A page is understood semantically *before* — and independently of — any upload.
- **Consent-gated capture, off by default.** Content scripts check `getConsent()` / GPC opt-out before capturing.
- **On-device PII redaction before upload** — [redact.ts](extension-v2/src/lib/redact.ts) strips email/phone/card/SSN/API-key/bearer tokens and flags health/religion special-category terms.
- **Scoped host permissions.** The extension no longer requests `<all_urls>`; `manifest.json` lists a specific allowlist (localhost, misir.app, HF/jsdelivr for model weights, + the 9 AI platforms).
- **Backend is the trust boundary.** Supabase is accessed with the **service-role key only**; RLS is off; the FastAPI layer (Clerk-JWT-authenticated) enforces per-user isolation. **Synthesis** runs server-side under that boundary; **embeddings now run in both places** (client for matching, server for storage/cross-linking).
- **Third-party inference disclosure.** Artifact text is sent to **Groq** (LLM), and the server *may* use **Nomic**'s hosted API for embeddings (`EMBEDDING_PROVIDER=nomic`). Model *weights* are additionally fetched from the **Hugging Face hub** by the extension on first use. These are sub-processor / third-party-request relationships.

> **Ownership:** privacy & legal compliance is handled by a **separate team**, and its documentation lives **outside this repo**. This section states code-level facts only — it is not a compliance assessment. Route sub-processor/DPA questions (Groq, Nomic, HF) to that team.

---

## 7. Honest limitations

- **The model can still be wrong inside the lines.** Grounding/citation enforcement reduces hallucination but doesn't eliminate misinterpretation of cited sources. The citation requirement makes errors *checkable*, not impossible.
- **Goal quality drives output quality.** A vague space `goal` yields vague synthesis — "actionable for your goal" is only as good as the goal you wrote.
- **Single-provider dependency.** All generation is Groq/Llama-4-Scout today. The single-client design makes swapping providers a one-file change, but there is currently no multi-provider fallback for *generation* (only embeddings have local/hosted options).
- **English-centric NLP.** `wink-eng-lite-web-model` is English; non-English capture degrades to weaker keyword/entity extraction.

---

## 8. One-paragraph version (for a deck or a reviewer)

> Misir uses AI as a disciplined synthesis layer over a deterministic core. Capture, matching, scoring, and nudge-triggering are all deterministic, and the heavy ones run **locally in the browser**: the extension executes the same Nomic embedding model on-device (transformers.js/WASM) to understand and route a page semantically **without uploading it**, using thresholds tuned against a real eval corpus. A single rate-limited Groq/Llama-4 client handles the genuinely AI-shaped work: extracting goal-aware insights from each artifact, rolling them up into per-space summaries and dashboard reports, generating starter spaces, phrasing nudges, and powering a grounded chat. Because the client and server share one embedding contract byte-for-byte, their vectors are directly comparable — which is what makes cross-space linking pure vector math with zero generation. Two rules make the AI trustworthy: **every insight must cite the evidence it came from**, and **the LLM is never allowed to produce a number** — all percentages come from a separate deterministic confidence service. AI is gated by engagement, capped by top-K, cached by content hash, and always backed by a deterministic fallback, so it runs rarely, costs little, and never takes the product down when it fails.
