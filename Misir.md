# Misir — Codebase Documentation

> Decision-readiness for founders and operators.
> Tracks your sources and tells you when you're ready to decide.

*Last verified against the code: 2026-07-15.*

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Tech Stack](#tech-stack)
5. [Backend](#backend)
6. [Frontend](#frontend)
7. [Chrome Extension](#chrome-extension)
8. [Design System](#design-system)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Core Algorithms](#core-algorithms)
12. [Authentication & Authorization](#authentication--authorization)
13. [Privacy & Compliance](#privacy--compliance)
14. [CI/CD](#cicd)
15. [Environment & Configuration](#environment--configuration)
16. [Build & Run](#build--run)
17. [Notable Patterns & Conventions](#notable-patterns--conventions)
18. [Known Issues & Technical Debt](#known-issues--technical-debt)

---

## Project Overview

**Misir** is a decision-readiness tool for founders. It captures research artifacts — web articles, AI chat transcripts, PDFs — across user-defined **spaces**, analyzes coverage and gaps, and tells users when they have enough signal to act on a decision. The system tracks engagement depth, surfaces knowledge gaps, generates nudges, and produces four kinds of AI-powered reports.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Space** | A decision area created by the user (e.g., "Should I launch in Indonesia?"). Contains subspaces, markers, artifacts, and gaps. |
| **Subspace** | A sub-topic within a space (e.g., "Regulatory", "Competition"). Carries weighted markers. |
| **Marker** | A labeled dimension used to score coverage (e.g., "competitor pricing", "regulatory risk"). Weighted 0-1. |
| **Artifact** | A captured research item — web article or AI chat. Stored with engagement metrics, content hash, and matched markers. |
| **Gap** | A detected knowledge gap within a space. Has severity (Critical/High/Medium), status (open/in_progress/resolved), and recurring count. |
| **Nudge** | An AI-generated prompt encouraging the user to fill a gap, set a deadline, or take action. |
| **Misir Read** | A concise summary of the space's current state — headline, key points, coverage %, gap count. |
| **Cross-space Link** | A similarity connection between an artifact in one space and a gap in another (cosine similarity on embeddings). |
| **Engagement Level** | How deeply the user engaged with content: latent → passive → active → deep. Based on dwell time, scroll depth, reading speed. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Chrome Extension MV3 (extension-v2)           │
│  Content Scripts ── Platform Extractors (9 AI platforms)     │
│  Engagement Tracker ── Readability Extractor ── Consent gate │
│  Offscreen Doc ── ON-DEVICE Nomic embedder (transformers.js) │
│  Hybrid semantic+lexical matching ── PII redaction           │
│  Background SW ── Cache Sync ── Dexie (IndexedDB)            │
└────────────┬────────────────────────────────────────────────┘
             │ REST API (Bearer JWT) — redacted text + local 768d vectors
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Python 3.12)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Auth/Clerk  │  │  API Layer   │  │  Application      │  │
│  │  JWT + JWKS  │  │  /spaces     │  │  Handlers         │  │
│  │              │  │  /chat       │  │  - chat_handler    │  │
│  │              │  │  /privacy    │  │  - report_handler   │  │
│  └──────────────┘  │  /auth       │  └───────────────────┘  │
│                    └──────────────┘                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Infrastructure / Services                 │   │
│  │  embedding_service  synthesis_service  groq_client     │   │
│  │  confidence_service  nudge_engine  cross_space_linker  │   │
│  └──────────────────────────────────────────────────────┘   │
│                    │                                         │
│                    ▼                                         │
│           Supabase (PostgreSQL + pgvector)                   │
└─────────────────────────────────────────────────────────────┘
             ▲
             │ REST API (ky, Bearer JWT)
┌─────────────────────────────────────────────────────────────┐
│               Next.js 16 Frontend (React 19)                 │
│  RSC + Client Components  ·  TanStack Query  ·  Zustand     │
│  Clerk Auth  ·  Tailwind v4  ·  Radix UI  ·  Zod            │
│  Onboarding Flow → Dashboard (8 views) → Chat (SSE)         │
└─────────────────────────────────────────────────────────────┘
```

### LLM Pipeline (Two-Stage)

```
Stage A (Per-Space Synthesis)
  └─ summarize artifacts per space
  └─ produce source_synthesis + space_summary rows

Stage B (Report Generation — 4 kinds)
  ├─ Misir Read     → headline + key points + coverage + gaps
  ├─ Comparison     → side-by-side pros/cons on a key tension
  ├─ Synthesis      → consensus / conflict / blindspot analysis
  └─ Decision       → concrete decision with option A vs B
```

All numeric outputs (confidence scores, readiness %, coverage) come from the **deterministic confidence engine** (`confidence_service.py`), never from the LLM.

---

## Directory Structure

```
D:\Misir Tech Team\
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI: backend (pytest), frontend (lint+tsc), extension-v2 (tests + strict tsc via build)
├── backend/
│   ├── main.py                       # FastAPI entry point, lifespan, route mounts
│   ├── requirements.txt              # Python dependencies
│   ├── Procfile                      # Heroku: web (uvicorn) + worker (job queue)
│   ├── .env.example                  # All required env vars (documented)
│   ├── core/
│   │   └── config.py                 # Settings model (pydantic-settings), env vars, defaults
│   ├── auth/
│   │   └── clerk.py                  # JWT validation, JWKS caching, CurrentUser dependency
│   ├── domain/
│   │   └── entities/
│   │       └── common.py             # Pydantic models shared across API responses
│   ├── interfaces/
│   │   └── api/
│   │       ├── auth.py               # GET /auth/me — current user profile
│   │       ├── spaces.py             # CRUD + AI generation for spaces/subspaces/markers
│   │       ├── chat.py               # SSE streaming chat via Groq
│   │       └── privacy.py            # Consent ledger, DSAR export, account erasure, retention purge
│   ├── application/
│   │   └── handlers/
│   │       ├── chat_handler.py       # Context builder + Groq stream orchestrator
│   │       └── report_handler.py     # Stage B report composition, dashboard payload assembly
│   ├── infrastructure/
│   │   └── services/
│   │       ├── embedding_service.py  # Local or nomic API, 768d vectors, warm-up on startup
│   │       ├── synthesis_service.py  # Two-stage pipeline orchestration
│   │       ├── confidence_service.py # Deterministic confidence/readiness math
│   │       ├── nudge_engine.py       # 4 deterministic rules + Groq phrasing
│   │       ├── cross_space_linker.py # Cosine similarity across spaces
│   │       └── groq_client.py        # Rate-limited Groq client, priority queuing
│   └── v2.0/
│       ├── schema.sql                # Full DB schema (all tables, enums, indexes)
│       └── privacy_migration.sql     # Consent ledger + audit log migration
├── frontend/
│   ├── package.json
│   ├── AGENTS.md                     # Warning: Next.js 16 breaking changes
│   ├── CLAUDE.md
│   ├── next.config.ts                # CSP (enforced + report-only), security headers
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── components.json               # shadcn/ui config
│   ├── tsconfig.json
│   ├── .env.local
│   └── src/
│       ├── app/
│       │   ├── layout.tsx            # Root layout: fonts, theme bootstrap, Providers, ConsentBanner
│       │   ├── providers.tsx         # ClerkProvider + QueryClient + Toaster
│       │   ├── globals.css
│       │   ├── onboarding/
│       │   │   └── page.tsx          # Redirect to dashboard if spaces exist, else OnboardingFlow
│       │   └── dashboard/
│       │       └── [scope]/
│       │           └── [view]/
│       │               └── page.tsx  # Dynamic route: scope (space id or "all") + view (8 views)
│       ├── components/
│       │   ├── ui/                   # Radix-based primitives (button, card, dialog, input, tabs, etc.)
│       │   ├── privacy/
│       │   │   └── ConsentBanner.tsx
│       │   ├── onboarding/
│       │   │   ├── OnboardingFlow.tsx
│       │   │   ├── SetupOverlay.tsx
│       │   │   ├── StepChallenge.tsx
│       │   │   ├── StepOutcome.tsx
│       │   │   ├── StepExtension.tsx
│       │   │   ├── StepWrap.tsx
│       │   │   └── ObChrome.tsx
│       │   └── misir/
│       │       ├── shell/
│       │       │   ├── ViewDispatcher.tsx  # Switch on view → component
│       │       │   ├── Topbar.tsx
│       │       │   ├── Sidebar.tsx
│       │       │   ├── SpaceTabNav.tsx
│       │       │   └── MobileNav.tsx
│       │       ├── home/
│       │       │   ├── HomeAll.tsx         # "all" scope dashboard
│       │       │   └── HomeSingle.tsx      # Single space overview
│       │       ├── decision/
│       │       │   └── DecisionView.tsx
│       │       ├── inbox/
│       │       │   └── InboxView.tsx
│       │       ├── notifications/
│       │       │   └── NotificationsView.tsx
│       │       ├── collection/
│       │       │   └── CollectionView.tsx
│       │       ├── comparison/
│       │       │   └── ComparisonView.tsx
│       │       ├── settings/
│       │       │   └── SettingsView.tsx
│       │       ├── chat/
│       │       ├── nudges/
│       │       ├── spaces/
│       │       ├── subspace/
│       │       └── primitives/
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts          # useApi() — client-side ky with Clerk JWT
│       │   │   ├── server.ts          # serverApi() — server-side ky with Clerk JWT
│       │   │   ├── types.ts           # TypeScript mirrors of backend Pydantic models
│       │   │   ├── spaces.ts
│       │   │   ├── subspaces.ts
│       │   │   ├── artifacts.ts
│       │   │   ├── inbox.ts
│       │   │   ├── gaps.ts
│       │   │   ├── nudges.ts
│       │   │   ├── deadlines.ts
│       │   │   ├── dashboard.ts
│       │   │   ├── privacy.ts
│       │   │   ├── me.ts
│       │   │   ├── chat.ts
│       │   │   ├── adapters.ts        # Extension adapter type definitions
│       │   │   └── capture-adapters.ts
│       │   ├── hooks/
│       │   │   ├── useSpaces.ts
│       │   │   ├── useSubspaces.ts
│       │   │   ├── useArtifacts.ts
│       │   │   ├── useInbox.ts
│       │   │   ├── useGaps.ts
│       │   │   ├── useNudges.ts
│       │   │   ├── useDeadline.ts
│       │   │   ├── useDashboard.ts
│       │   │   ├── useChat.ts
│       │   │   ├── useMisirAnswer.ts
│       │   │   ├── useUnreadCounts.ts
│       │   │   └── useTheme.ts
│       │   ├── stores/
│       │   │   └── ui-store.ts        # Zustand: modal state, Misir Asks, nudge dismiss
│       │   ├── constants/
│       │   │   ├── surface-icons.ts
│       │   │   ├── subspace-status.ts
│       │   │   ├── subspace-colors.ts
│       │   │   ├── space-decisions.ts
│       │   │   ├── space-colors.ts
│       │   │   ├── space-briefs.ts
│       │   │   ├── moments.ts
│       │   │   ├── misir-questions.ts
│       │   │   └── insights.ts
│       │   └── utils.ts
│       └── proxy.ts                   # Next.js API proxy (CSP nonce support)
├── extension-v2/                      # The Chrome extension (v2.0.0) — the only one
│   ├── package.json
│   ├── manifest.json
│   ├── vitest.config.ts               # Fast offline unit suite (mocked embeddings)
│   ├── vitest.eval.config.ts          # Model-backed matching eval (npm run eval)
│   ├── scripts/                       # copy-ort / trim-ort — onnxruntime wasm plumbing
│   ├── public/ort/                    # Bundled ORT wasm (MV3 CSP allows dynamic import from 'self' only)
│   ├── eval/                          # Matching eval harness (corpus, fixtures, real Nomic embeds)
│   └── src/
│       ├── background/                # MV3 service worker: sync, capture flow, message routing
│       ├── offscreen/                 # Hosts the WASM embedder (the service worker can't run it)
│       ├── content/
│       │   ├── index.ts               # Content script entry
│       │   ├── web-capture.ts         # Open-web capture
│       │   ├── platform-detector.ts   # Which AI platform (if any) this page is
│       │   ├── engagement.ts          # EngagementTracker: dwell/scroll/reading speed
│       │   ├── toolbar.tsx            # In-page UI
│       │   └── extractors/            # 9 per-platform extractors + base.ts (was `adapters/` in v1)
│       └── lib/
│           ├── embedder.ts            # ON-DEVICE Nomic embeddings (transformers.js, 768d, q8)
│           ├── matching.ts            # Hybrid semantic + lexical space/subspace matching
│           ├── redact.ts              # On-device PII redaction before upload
│           ├── consent.ts             # Consent gate (capture off by default)
│           └── db.ts                  # Dexie IndexedDB schema + sync helpers
└── .gitignore
```
> Privacy/legal docs are owned by a **separate team** and live outside this repo.
> Deleted 2026-07-15 (recoverable from git history): the legacy `extention/` extension, superseded by `extension-v2/`; and `design_handoff_claude_dark/`, the design handoff — its tokens are now ported into `frontend/src/app/globals.css` and `extension-v2/src/styles/globals.css`, and its fonts into `frontend/public/fonts/`.

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Language | Python 3.12 |
| Framework | FastAPI |
| Auth | Clerk (JWT + JWKS validation) |
| Database | Supabase (PostgreSQL 15 + pgvector) |
| LLM | Groq (llama-3.3-70b-variant default) |
| Embeddings | nomic-embed-text-v1.5 (768d, local or nomic API) |
| Rate Limiting | slowapi |
| Logging | structlog |
| Server | uvicorn (Heroku Procfile) |
| Job Queue | worker process (embedding + synthesis jobs) |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router, RSC) |
| UI | React 19 |
| Auth | @clerk/nextjs |
| Data Fetching | TanStack Query v5 |
| Client State | Zustand |
| HTTP Client | ky |
| Styling | Tailwind CSS v4 |
| UI Primitives | Radix UI (via shadcn/ui) |
| Validation | Zod |
| Fonts | Inter, Inter Tight, JetBrains Mono (next/font) |

### Chrome Extension

| Layer | Technology |
|-------|-----------|
| Manifest | MV3 |
| Build | Vite + CRXJS |
| UI Framework | React 18 |
| Local DB | Dexie (IndexedDB) |
| NLP | Wink NLP (offline) |
| **Embeddings** | **transformers.js + onnxruntime-web — Nomic 768d q8, on-device, in an offscreen document** |
| Content Extraction | Mozilla Readability |
| Testing | Vitest (unit) + a model-backed matching eval (`npm run eval`) |
| Type Check | TypeScript — **blocking** (`npm run build` runs `tsc` first) |

### Infrastructure

| Layer | Technology |
|-------|-----------|
| Hosting | Heroku (Procfile: `web` + `worker`) |
| Database Hosting | Supabase Cloud |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| CSP | Enforced (base-uri, object-src, frame-ancestors) + Report-Only (full policy) |

---

## Backend

### Entry Point (`main.py`)

- FastAPI app with `lifespan` context manager
- Embedding model warm-up on startup (loads nomic-embed-text-v1.5)
- Route mounts:
  - `/auth` → auth router
  - `/spaces` → spaces router (CRUD + AI generation)
  - `/chat` → chat router (SSE streaming)
  - `/privacy` → privacy router (consent, export, erase, retention)
- Middleware: slowapi rate limiter, CORS, structlog request logging

### Configuration (`core/config.py`)

Pydantic Settings model loading from environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | — |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | — |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT validation | — |
| `GROQ_API_KEY` | Groq LLM API key | — |
| `NOMIC_API_KEY` | Nomic embedding API key (optional, local if absent) | — |
| `RATE_LIMIT_STORAGE` | slowapi backend (`memory` or `redis://...`) | `memory` |
| `EMBEDDING_MODE` | `local` or `api` | `local` |

### Auth (`auth/clerk.py`)

- `get_jwks()`: Fetches and caches Clerk JWKS
- `validate_jwt(token)`: Validates JWT signature, expiry, issuer
- `CurrentUser` dependency: Extracts `clerk_user_id` from JWT for route handlers

### API Routes

#### `interfaces/api/auth.py`
- `GET /auth/me` — Returns current user profile (auth_user + profile join)

#### `interfaces/api/spaces.py`
- `GET /spaces` — List all spaces for current user
- `POST /spaces` — Create a space manually
- `POST /spaces/generate` — AI-generated space with subspaces and markers
- `GET /spaces/{id}` — Get space with subspaces and markers
- `PATCH /spaces/{id}` — Update space
- `DELETE /spaces/{id}` — Delete space
- `POST /spaces/{id}/subspaces` — Add subspace
- `POST /spaces/{id}/markers` — Add marker

#### `interfaces/api/chat.py`
- `POST /chat` — SSE streaming chat response via Groq
  - Builds context from recent artifacts + gaps
  - Streams tokens to client

#### `interfaces/api/privacy.py`
- `POST /privacy/consent` — Record consent in consent ledger
- `GET /privacy/export` — DSAR data export (all user data as JSON)
- `DELETE /privacy/erase` — Account erasure (GDPR right to delete)
- `POST /privacy/opt-out` — Global Privacy Control opt-out
- `POST /privacy/retention-purge` — Trigger retention policy enforcement

### Application Handlers

#### `chat_handler.py`
- Builds chat context window from:
  - Recent space artifacts
  - Open gaps
  - Previous conversation messages
- Orchestrates Groq streaming with system prompt + context

#### `report_handler.py`
- Stage B report composition:
  - Assembles `DashboardPayload` with: misirs_read, sources, synthesis, key_tension, decision, research_depth, activity, cross_space, gaps, nudges, deadline
  - Calls `synthesis_service` for each report kind
  - Populates `report_cache` table

### Infrastructure Services

#### `embedding_service.py`
- Mode: `local` (ONNX runtime) or `api` (nomic API)
- Model: nomic-embed-text-v1.5, 768-dimensional vectors
- Warm-up on app startup
- `embed(text: str) -> list[float]`
- `embed_batch(texts: list[str]) -> list[list[float]]`

#### `synthesis_service.py`
- **Stage A**: Per-space artifact summarization
  - Produces `source_synthesis` and `space_summary` rows
  - Groups artifacts by source/platform for theme extraction
- **Stage B**: Report generation (4 types)
  - `Misir Read`: Concise summary + coverage + gaps
  - `Comparison`: Pros/cons on key tension
  - `Synthesis`: Consensus/conflict/blindspot
  - `Decision`: Concrete options A vs B

#### `confidence_service.py`
- **Deterministic** — all numeric outputs, never from LLM
- Coverage score: weighted sum of matched markers / total markers
- Readiness %: formula based on coverage + gap severity distribution + artifact recency
- Research depth: bucketed threshold model

#### `nudge_engine.py`
- 4 deterministic rules:
  1. **Gap rule**: Open gap with no activity for N days → nudge
  2. **Deadline rule**: Deadline approaching with low coverage → nudge
  3. **Cross-space rule**: New cross-space link → nudge
  4. **Engagement rule**: High-engagement artifact with no space assignment → nudge
- Groq generates human-readable phrasing (scatter, direction, consequence, CTA)

#### `cross_space_linker.py`
- Compares artifact embeddings in one space against gap embeddings in another
- Cosine similarity threshold for link creation
- Populates `cross_space_link` table

#### `groq_client.py`
- Rate-limited wrapper around Groq API
- Priority queuing (high: chat, medium: reports, low: nudges)
- Default model: `llama-3.3-70b-variant`
- Retry with exponential backoff

---

## Frontend

### Routing Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/onboarding` | `OnboardingFlow` | 4-step onboarding (challenge → outcome → extension → wrap). Skips if spaces exist. |
| `/dashboard/[scope]/[view]` | `ViewDispatcher` | Dynamic route. `scope` = space ID or "all". `view` = one of 8 allowed views. |

### Allowed Views

| View ID | Component | Description |
|---------|-----------|-------------|
| `home` | `HomeAll` | All-spaces dashboard |
| `overview` | `HomeSingle` | Single space overview |
| `inbox` | `InboxView` | Artifacts inbox |
| `notification` | `NotificationsView` | Nudges and alerts |
| `collection` | `CollectionView` | Artifacts collection |
| `comparison` | `ComparisonView` | Comparison report |
| `decision` | `DecisionView` | Decision report |
| `settings` | `SettingsView` | Privacy and account settings |

### API Client Layer

- **`client.ts`**: `useApi()` hook — client-side ky instance with Clerk `getToken()` on every request
- **`server.ts`**: `serverApi()` — server-side ky for RSC / server actions
- **`types.ts`**: TypeScript mirrors of all backend Pydantic response models (see [Database Schema](#database-schema) for field details)
- Domain modules: `spaces.ts`, `subspaces.ts`, `artifacts.ts`, `inbox.ts`, `gaps.ts`, `nudges.ts`, `deadlines.ts`, `dashboard.ts`, `privacy.ts`, `me.ts`, `chat.ts`

### Hooks (TanStack Query)

Each domain has a dedicated hook file wrapping `useQuery` / `useMutation`:
- `useSpaces`, `useSubspaces`, `useArtifacts`, `useInbox`, `useGaps`
- `useNudges`, `useDeadline`, `useDashboard`, `useChat`
- `useMisirAnswer` (Misir Asks feature), `useUnreadCounts`, `useTheme`

### State Management

- **Server state**: TanStack Query (all API data)
- **Client state**: Zustand (`ui-store.ts`)
  - `mobileMenuOpen`, `modal` (new-space / new-chat)
  - `misirAsks` per-space (expanded, draft, submitted, answering, response, dismissed)
  - `nudgesDismissed` set

### Root Layout (`layout.tsx`)

- 3 Google Fonts: Inter (body), Inter Tight (headings), JetBrains Mono (mono)
- Theme bootstrap: reads `misir.theme` from localStorage, sets `data-theme` attribute before paint
- `Providers` wrapper: ClerkProvider + QueryClient + Toaster
- `ConsentBanner` rendered at root level

### Security Headers (`next.config.ts`)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | Enforced: base-uri 'self', object-src 'none', frame-ancestors 'none', upgrade-insecure-requests (prod) |
| `Content-Security-Policy-Report-Only` | Full policy: script-src (Clerk + Turnstile), connect-src (self + API + Clerk), etc. |
| `Strict-Transport-Security` | max-age=63072000; includeSubDomains |
| `X-Frame-Options` | DENY |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=(), browsing-topics=() |

---

## Chrome Extension

> Lives in `extension-v2/` (v2.0.0). The legacy `extention/` (sic) was deleted 2026-07-15.

### Architecture (MV3)

```
Service Worker (background/)
  ├── Cache sync (IndexedDB ↔ Supabase)
  ├── Artifact capture pipeline
  └── Message routing

Offscreen Document (offscreen/)
  └── Hosts the WASM embedder — a ~140 MB model + WASM inference
      cannot run in the service worker

Content Scripts
  ├── web-capture.ts      — open-web capture
  ├── platform-detector.ts — identifies the AI platform (if any)
  ├── extractors/          — 9 per-platform extractors + base.ts
  ├── engagement.ts        — EngagementTracker (dwell, scroll, reading speed)
  └── toolbar.tsx          — in-page UI

Library
  ├── embedder.ts — on-device Nomic embeddings (transformers.js)
  ├── matching.ts — hybrid semantic + lexical matching
  ├── redact.ts   — on-device PII redaction before upload
  ├── consent.ts  — consent gate (capture off by default)
  └── db.ts       — Dexie schema + sync helpers
```

### On-Device Embeddings (`lib/embedder.ts`)

The extension runs the **same embedding model as the backend, locally in the browser** — so page content can be understood semantically without being uploaded.

| Property | Value |
|---|---|
| Model | `nomic-ai/nomic-embed-text-v1.5` (768d), q8-quantized (~140 MB) |
| Runtime | transformers.js + onnxruntime-web (WASM), `numThreads=1` |
| Where | **Offscreen document** — not the service worker |
| Weights | Fetched from the HF hub on first use, browser-cached |
| ORT wasm | Bundled in `public/ort/` — MV3 CSP only permits dynamic import from `'self'` |

The contract is mirrored **byte-for-byte** with `backend/infrastructure/services/embedding_service.py` — same model/dims, `search_query:` prefix for the page and `search_document:` for spaces, mean-pooled + L2-normalized (so cosine == dot product). **Client and server vectors are therefore directly comparable.**

### Platform Extractors (`content/extractors/`)

| Adapter | Host |
|---------|------|
| ChatGPT | chat.openai.com, chatgpt.com |
| Claude | claude.ai |
| Perplexity | perplexity.ai |
| DeepSeek | chat.deepseek.com |
| Grok | grok.x.ai, x.ai |
| Gemini | gemini.google.com |
| Copilot | copilot.microsoft.com |
| NotebookLM | notebooklm.google.com |
| Kimi | kimi.moonshot.cn |

### Content Capture Pipeline

1. **Content script** detects page matches adapter host pattern
2. **Adapter** observes DOM for new messages
3. **`capture.ts`** extracts content via Mozilla Readability
4. **Content hash** (SHA-256) prevents duplicates
5. **Engagement tracker** monitors: dwell time, scroll depth, reading speed (Wink NLP)
6. **Marker matching** (`matching.ts`): Two-stage — filter candidates, then compute coverage score
7. **Store to IndexedDB** (Dexie) → sync to Supabase when online

### Engagement Levels

| Level | Criteria |
|-------|----------|
| `latent` | Page loaded, minimal interaction |
| `passive` | Some scroll, short dwell |
| `active` | Significant scroll, moderate dwell, selection/copy |
| `deep` | High scroll depth, long dwell, reading speed matches full consumption |

---

## Design System

The design system now lives **in the code itself** — the design-handoff folder it was ported from was deleted 2026-07-15 (recoverable from git history).

| What | Where |
|-------|-------|
| Tokens + `@font-face` (frontend) | `frontend/src/app/globals.css` |
| Tokens (extension) | `extension-v2/src/styles/globals.css` — shadcn HSL triples + `--m-*` direct colors |
| Font files | `frontend/public/fonts/` (Copernicus, Styrene B, Fira Code) |

### Fonts

| Role | Family | Weights |
|------|--------|---------|
| Body | Inter | 400, 500, 600, 700 |
| Headings | Inter Tight | 500, 600, 700, 800 |
| Monospace | JetBrains Mono | 400, 500 |

### Color Tokens

| Token | Light | Dark |
|-------|-------|------|
| Background | White/off-white | Dark gray |
| Surface | Subtle gray | Elevated gray |
| Primary | Brand blue | Brand blue (adjusted) |
| Accent | Highlight blue | Highlight blue (adjusted) |
| Success | Green | Green (adjusted) |
| Warning | Amber | Amber (adjusted) |
| Error | Red | Red (adjusted) |
| Text primary | Near-black | Near-white |
| Text secondary | Mid-gray | Mid-gray (adjusted) |

Theme is controlled via `data-theme="light|dark"` on `<html>` and toggled by reading `misir.theme` from localStorage.

### Spacing Scale

CSS custom properties based on 4px base unit (`--space-1` = 4px, `--space-2` = 8px, etc.)

### Component Specs

- **Onboarding**: 4-step horizontal stepper (Challenge → Outcome → Extension → Wrap)
- **Dashboard**: Multi-panel layout with sidebar navigation, 8 view tabs, responsive collapsing
- **Cards**: Artifact cards, gap cards, nudge cards with consistent shadow/radius tokens
- **Chat**: Misir Asks expandable input in side panel, full conversation in chat view

---

## Database Schema

> Schema: `misir` in Supabase (PostgreSQL 15 + pgvector)
> Source: `backend/v2.0/schema.sql`

### Enums

```sql
content_source  : 'web' | 'ai_chat'
engagement_level: 'latent' | 'passive' | 'active' | 'deep'
gap_severity    : 'Critical' | 'High' | 'Medium'
gap_status      : 'open' | 'in_progress' | 'resolved'
nudge_status    : 'active' | 'dismissed' | 'acted'
report_kind     : 'misir_read' | 'comparison' | 'synthesis' | 'decision'
chat_role       : 'user' | 'misir'
```

### Tables

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `auth_user` | Clerk-linked user | `id`, `clerk_user_id`, `email`, `created_at` |
| `profile` | User profile | `user_id`, `display_name`, `avatar_url`, `onboarding_complete`, `default_space_id` |
| `space` | Decision area | `id`, `user_id`, `name`, `goal`, `description`, `created_at`, `updated_at` |
| `subspace` | Sub-topic within space | `id`, `space_id`, `name`, `description`, `created_at`, `updated_at` |
| `marker` | Coverage dimension | `id`, `space_id`, `label`, `weight`, `created_at` |
| `subspace_marker` | Marker-subspace join | `subspace_id`, `marker_id`, `weight`, `source` |
| `artifact` | Captured research item | `id`, `user_id`, `space_id`, `url`, `normalized_url`, `domain`, `title`, `extracted_text`, `content_hash`, `word_count`, `content_source`, `platform`, `engagement_level`, `dwell_time_ms`, `scroll_depth`, `reading_depth`, `base_weight`, `matched_marker_ids`, `captured_at`, `updated_at`, `metadata` (jsonb) |
| `artifact_tag` | Tags on artifacts | `artifact_id`, `tag` |
| `artifact_open_event` | Revisit tracking | `artifact_id`, `count` |
| `gap` | Knowledge gap | `id`, `space_id`, `subspace_id`, `severity`, `label`, `action`, `status`, `recurring_count`, `first_seen_at`, `last_seen_at`, `resolved_at` |
| `deadline` | User-set deadline | `id`, `user_id`, `space_id`, `label`, `due_at`, `target_pct`, `created_at`, `updated_at` |
| `nudge` | AI-generated prompt | `id`, `user_id`, `space_id`, `scatter`, `direction`, `consequence`, `cta_label`, `cta_href`, `priority`, `status`, `evidence_data` (jsonb), `requires_deadline`, `generated_at`, `dismissed_at` |
| `chat_conversation` | Chat thread | `id`, `user_id`, `space_id`, `title`, `archived_at`, `created_at`, `updated_at` |
| `chat_message` | Individual message | `id`, `conversation_id`, `role`, `content`, `context_hash`, `token_count`, `created_at` |
| `cross_space_link` | Cross-space connection | `id`, `source_artifact_id`, `target_gap_id`, `similarity` |
| `consent` | Consent ledger | `id`, `user_id`, `purpose`, `granted`, `granted_at`, `revoked_at`, `source` |
| `audit_log` | Audit trail | `id`, `user_id`, `action`, `resource_type`, `resource_id`, `metadata` (jsonb), `created_at` |
| `report_cache` | Cached LLM reports | `id`, `space_id`, `kind`, `payload` (jsonb), `generated_at` |
| `source_synthesis` | Per-source synthesis | `id`, `space_id`, `source_type`, `themes` (jsonb), `summary`, `created_at` |
| `space_summary` | Space-level summary | `id`, `space_id`, `summary`, `coverage_pct`, `readiness_pct`, `created_at` |

### Indexes

- `artifact.content_hash` — deduplication
- `artifact.space_id` — space-scoped queries
- `artifact.embedding` — pgvector IVFFlat index (cosine)
- `gap.space_id`, `gap.status` — gap lookups
- `nudge.user_id`, `nudge.status` — nudge queries
- `consent.user_id`, `consent.purpose` — consent checks
- `audit_log.user_id`, `audit_log.created_at` — audit queries

### Privacy Migration (`v2.0/privacy_migration.sql`)

Adds:
- `consent` table with purpose, granted/revoked, source tracking
- `audit_log` table with action, resource_type, resource_id, metadata
- Row-level security policies on consent and audit_log
- Retention policy trigger functions

---

## API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user profile |

### Spaces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/spaces` | List user's spaces |
| POST | `/spaces` | Create space |
| POST | `/spaces/generate` | AI-generate space with subspaces + markers |
| GET | `/spaces/{id}` | Get space with children |
| PATCH | `/spaces/{id}` | Update space |
| DELETE | `/spaces/{id}` | Delete space |
| POST | `/spaces/{id}/subspaces` | Add subspace |
| POST | `/spaces/{id}/markers` | Add marker |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | SSE streaming chat (returns `text/event-stream`) |

### Privacy

| Method | Path | Description |
|--------|------|-------------|
| POST | `/privacy/consent` | Record consent |
| GET | `/privacy/export` | DSAR data export |
| DELETE | `/privacy/erase` | Account erasure |
| POST | `/privacy/opt-out` | GPC opt-out |
| POST | `/privacy/retention-purge` | Retention enforcement |

---

## Core Algorithms

### Space/Subspace Matching (`extension-v2/src/lib/matching.ts`)

Hybrid **semantic + lexical**, run on-device. Thresholds are tuned against the real eval corpus (`extension-v2/eval/`) — the constants carry their rationale in comments; read them before tuning.

1. **Keyword pre-gate** — if the page hits no space's markers, skip the (expensive WASM) embedding entirely.
2. **Pick the space — semantic score only.** `SEMANTIC_FLOOR = 0.60` (real pages score 0.72–0.78; off-topic noise sits ~0.50–0.53) and `SPACE_MARGIN = 0.07` over the runner-up. Keyword coverage is deliberately *not* used to pick the space: generic markers ("storage", "water", "brew") let the wrong space win.
3. **Lexical tie-break** — semantically adjacent spaces (e.g. "Good Coffee" vs "Good Tea") can sit inside the margin. If the top space has `SPACE_LEX_TIEBREAK_MARGIN = 3` more distinct evidence terms *and* higher keyword coverage, trust it.
4. **Pick the subspace** — siblings bunch tightly (~6 within an 8-point band), so keyword carries real weight: `SUBSPACE_SEMANTIC_WEIGHT = 0.75` semantic / 0.25 keyword, with `SINGLE_MARKER_DERATE = 0.5` so a lone incidental marker can't hijack the pick.
5. **Threshold** — `MATCH_THRESHOLD = 0.45` combined confidence to count as a match.

**Precision over recall by design:** a page ambiguous on *both* signals is left unmatched rather than force-fit.

**Correction feedback loop:** user corrections promote a page's salient terms to low-weight `source='learned'` markers (POS/NER-gated client-side, junk-filtered server-side in `interfaces/api/markers.py`), which is why keyword weight at the subspace stage matters — it lets learned markers actually move a bunched ranking.

### Confidence Engine (`confidence_service.py`)

Deterministic — no LLM involved:

```
Coverage = Σ(matched_marker.weight) / Σ(all_marker.weight)
Readiness = f(coverage, gap_severity_distribution, artifact_recency, engagement_depth)
Research Depth = bucketed(pct_artifacts_with_deep_engagement)
```

### Nudge Rules (`nudge_engine.py`)

1. **Gap rule**: Open gap, no artifact in N days → "You haven't explored [gap] yet"
2. **Deadline rule**: Deadline in < 7 days, coverage < target_pct → "Deadline approaching on [space]"
3. **Cross-space rule**: New cross_space_link → "[artifact] might also help with [gap]"
4. **Engagement rule**: Deep-engagement artifact unassigned → "Where does [artifact] belong?"

### Cross-Space Linking (`cross_space_linker.py`)

```
for each artifact embedding in space A:
  for each gap embedding in space B (B ≠ A):
    similarity = cosine_similarity(artifact.embedding, gap.embedding)
    if similarity > threshold:
      create cross_space_link
```

---

## Authentication & Authorization

- **Provider**: Clerk (https://clerk.com)
- **Backend**: JWT validation via JWKS. `CurrentUser` FastAPI dependency extracts `clerk_user_id` from token.
- **Frontend**: `@clerk/nextjs` — `useAuth()` for client, `auth()` from `@clerk/nextjs/server` for RSC.
- **Extension**: Sends Clerk JWT as `Authorization: Bearer` header to API.
- **Token flow**: Every API request fetches a fresh JWT via `getToken()`, attached to `Authorization` header.

---

## Privacy & Compliance

> **Ownership:** privacy/legal assessment is handled by a **separate team**, and its documentation lives **outside this repo**. This section documents only the *code-side mechanisms* present in this codebase — it is not a compliance status or a legal clearance.

### Consent Architecture

- **Consent ledger** (`consent` table): purpose, granted/revoked timestamps, source (UI/GPC/provider)
- **ConsentBanner** component: Global privacy notice with opt-in/out
- **GPC support**: `POST /privacy/opt-out` handles Global Privacy Control signals

### Data Subject Rights

Actual routes in `interfaces/api/privacy.py` (all under `/api/v1`):

| Right | Endpoint |
|-------|----------|
| Consent read/write | `GET /me/consent`, `PUT /me/consent` |
| Access / portability (DSAR) | `GET /me/export` |
| Erasure (GDPR Art. 17) | `DELETE /me` (FK cascade + best-effort Clerk identity deletion) |
| Retention purge | `POST /internal/purge-expired` (internal token; pg_cron is the production path) |

Covered by `backend/tests/test_privacy.py` (consent/GPC, export shape, purge counts, ownership checks).

### Audit Trail

- `audit_log` table records: action, resource_type, resource_id, metadata, timestamp
- Backed by `infrastructure/services/audit_service.py`

### On-Device Privacy (extension)

- **Capture is off by default**, gated by `lib/consent.ts`
- **PII redaction before upload** (`lib/redact.ts`): email, phone, credit card, SSN, API keys, bearer tokens, plus health/religion special-category term lists
- **Embeddings run locally** (`lib/embedder.ts`) — semantic understanding without uploading page content
- **No `<all_urls>`** — host permissions are a scoped allowlist

---

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

Three parallel jobs on push/PR:

| Job | Runner | Steps |
|-----|--------|-------|
| **Backend** | ubuntu-latest, Python 3.12 | `pip install -r requirements.txt` → `pytest -q` |
| **Frontend** | ubuntu-latest, Node 20 | `npm ci` → `npm run lint` → `tsc --noEmit` (continue-on-error) |
| **Extension** | ubuntu-latest, Node 20 | `npm install` → `npm run build` → `vitest run` → `tsc --noEmit` (continue-on-error) |

### Notes

- Backend uses dummy env vars for CI (`SUPABASE_URL=dummy`, etc.)
- Frontend type-check is non-blocking due to pre-existing type debt
- Extension has no committed lockfile yet (uses `npm install` not `npm ci`)
- No CD pipeline — deployment is manual (Heroku `git push`)

---

## Environment & Configuration

### Backend `.env.example`

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CLERK_JWKS_URL=
GROQ_API_KEY=
NOMIC_API_KEY=          # Optional — uses local ONNX if absent
RATE_LIMIT_STORAGE=memory
EMBEDDING_MODE=local    # "local" (ONNX) or "api" (nomic cloud)
```

### Frontend `.env.local`

```
NEXT_PUBLIC_API_URL=           # FastAPI backend URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

### Extension

No env configuration needed at build time — API URL is configurable via extension settings.

---

## Build & Run

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev       # Development server
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # Type check
```

### Extension

```bash
cd extension-v2
npm install        # No lockfile committed yet
npm run build      # Vite + CRXJS production build
npx vitest run     # Run tests
npx tsc --noEmit   # Type check
```

### Full Stack (Heroku)

```bash
# Backend deploys via:
git push heroku main
# Procfile defines:
#   web: uvicorn main:app --host 0.0.0.0 --port $PORT
#   worker: python -m worker  # Job queue for embedding/synthesis
```

---

## Notable Patterns & Conventions

### Code Conventions

- **Backend**: Clean architecture (domain → application → infrastructure → interfaces)
- **Frontend**: App Router with RSC + client components (`"use client"`), co-located API types, hooks pattern
- **Extension**: MV3 service worker pattern, content script isolation

### Key Patterns

1. **Deterministic over LLM**: All numeric computations (confidence, readiness, coverage, nudge priority) are deterministic. LLM is used only for text generation (chat, report prose, nudge phrasing).
2. **Offline-first extension**: Dexie IndexedDB as primary store, sync to Supabase when online. Engagement tracking works offline.
3. **Content deduplication**: SHA-256 `content_hash` on artifacts prevents duplicate captures.
4. **Two-phase CSP**: Enforced policy for safe directives, Report-Only for full policy — allows safe rollout.
5. **Server/client API split**: `serverApi()` for RSC (no Clerk hook), `useApi()` for client components.
6. **Cheap gate before expensive signal**: the keyword pre-gate skips on-device WASM embedding for pages that hit no markers at all.
7. **Same embedding contract client and server**: `lib/embedder.ts` mirrors `embedding_service.py` byte-for-byte (model, dims, prefixes, normalization) so vectors are comparable across the boundary.

### Anti-Patterns to Avoid

- Never use LLM for numeric outputs (use `confidence_service.py` instead)
- Never bypass the consent ledger for data processing
- Never hardcode platform host lists outside `content/extractors/index.ts` + `manifest.json` host_permissions
- Never commit secrets (env vars only, `.env.example` documents all)

---

## Known Issues & Technical Debt

> **Legal & privacy compliance is tracked by a separate team, outside this repo.** The former `Misir-Legal-Compliance-Blockers.md` and `Misir-Privacy-Compliance-Report.md` were removed from this repo on 2026-07-15 (still recoverable from git history). Do not re-create compliance tracking here — see that team for status.

### Technical Debt

- **The synthesis pipeline has no tests.** `backend/tests/` covers auth, DoS, privacy, and scaling — but `synthesis_service.py`, `confidence_service.py`, `nudge_engine.py`, and `cross_space_linker.py` (the core IP) have no direct coverage.
- Frontend TypeScript strict check is `continue-on-error` in CI (pre-existing type debt).
- The model-backed matching eval (`npm run eval`) is not a CI gate by design — it downloads ~90 MB. Run it when touching matching.
- No CD pipeline (manual Heroku deployment).

### Resolved

- ~~Extension directory misspelled (`extention/`)~~ — legacy extension **deleted 2026-07-15**; `extension-v2/` is the only one.
- ~~No committed `package-lock.json` in extension~~ — `extension-v2` commits one; CI uses `npm ci`.
- ~~Extension TypeScript strict check is non-blocking~~ — `extension-v2`'s `npm run build` runs `tsc` first, so type-checking **blocks** CI.
