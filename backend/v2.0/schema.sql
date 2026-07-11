-- =============================================================================
-- Misir v2.0 — Fresh database schema
-- Schema: misir
-- Engine: PostgreSQL 15+ via Supabase
-- Extensions: pgvector (vector similarity), pg_cron (optional background jobs)
-- Auth: Clerk JWT — backend uses service-role; RLS is OFF
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Drop + recreate schema for clean slate
DROP SCHEMA IF EXISTS misir CASCADE;
CREATE SCHEMA misir;
SET search_path TO misir, public;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE misir.platform_type AS ENUM (
    'claude', 'chatgpt', 'gemini', 'perplexity',
    'deepseek', 'grok', 'copilot', 'notebooklm', 'kimi', 'web'
);

CREATE TYPE misir.engagement_level AS ENUM ('latent', 'passive', 'active', 'deep');

CREATE TYPE misir.gap_severity AS ENUM ('Critical', 'High', 'Medium');

CREATE TYPE misir.gap_status AS ENUM ('open', 'in_progress', 'resolved');

CREATE TYPE misir.nudge_status AS ENUM ('active', 'dismissed', 'acted');

CREATE TYPE misir.cross_link_status AS ENUM ('suggested', 'accepted', 'dismissed');

CREATE TYPE misir.report_kind AS ENUM ('misir_read', 'comparison', 'synthesis', 'decision');

CREATE TYPE misir.report_period AS ENUM ('today', 'week', 'month');

-- =============================================================================
-- AUTH + PROFILE
-- =============================================================================

CREATE TABLE misir.auth_user (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id   TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_user_clerk ON misir.auth_user (clerk_user_id);

CREATE TABLE misir.profile (
    id          UUID PRIMARY KEY REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    display_name TEXT,
    timezone    TEXT DEFAULT 'UTC',
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SPACES
-- =============================================================================

CREATE TABLE misir.space (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    goal        TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_space_user ON misir.space (user_id);

CREATE TABLE misir.subspace (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id    BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subspace_space ON misir.subspace (space_id);

CREATE TABLE misir.marker (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id    BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    weight      FLOAT NOT NULL DEFAULT 1.0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marker_space ON misir.marker (space_id);

CREATE TABLE misir.subspace_marker (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subspace_id BIGINT NOT NULL REFERENCES misir.subspace (id) ON DELETE CASCADE,
    marker_id   BIGINT NOT NULL REFERENCES misir.marker (id) ON DELETE CASCADE,
    weight      FLOAT NOT NULL DEFAULT 1.0,
    source      TEXT,
    UNIQUE (subspace_id, marker_id)
);

CREATE INDEX idx_subspace_marker_subspace ON misir.subspace_marker (subspace_id);

-- =============================================================================
-- ARTIFACTS
-- =============================================================================

CREATE TABLE misir.artifact (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    space_id            BIGINT REFERENCES misir.space (id) ON DELETE SET NULL,
    -- The extension matches on-device down to a specific subspace; persist it so
    -- subspace-level views (Collection tags, per-subspace activity) are exact
    -- rather than re-derived from marker overlap.
    subspace_id         BIGINT REFERENCES misir.subspace (id) ON DELETE SET NULL,

    -- Content identity
    url                 TEXT NOT NULL,
    normalized_url      TEXT NOT NULL,
    domain              TEXT,
    title               TEXT,
    extracted_text      TEXT,
    content_hash        TEXT,
    word_count          INT NOT NULL DEFAULT 0,

    -- Source classification
    content_source      TEXT,                           -- 'ai_chat' | 'web'
    platform            misir.platform_type NOT NULL,

    -- Engagement
    engagement_level    misir.engagement_level NOT NULL DEFAULT 'latent',
    dwell_time_ms       BIGINT NOT NULL DEFAULT 0,
    scroll_depth        FLOAT NOT NULL DEFAULT 0,
    reading_depth       FLOAT NOT NULL DEFAULT 0,
    base_weight         FLOAT NOT NULL DEFAULT 1.0,    -- latent=0.2, passive=1.0, active=2.0 (initial)

    -- Embedding (computed async after capture)
    content_embedding   vector(768),

    -- Extension matching context
    matched_marker_ids  BIGINT[] NOT NULL DEFAULT '{}',

    -- Timestamps
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata            JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_artifact_user ON misir.artifact (user_id);
CREATE INDEX idx_artifact_space ON misir.artifact (space_id);
CREATE INDEX idx_artifact_subspace ON misir.artifact (subspace_id);
CREATE INDEX idx_artifact_user_space ON misir.artifact (user_id, space_id);
CREATE INDEX idx_artifact_platform ON misir.artifact (platform);
CREATE INDEX idx_artifact_url ON misir.artifact (normalized_url);
CREATE INDEX idx_artifact_captured ON misir.artifact (captured_at DESC);
CREATE INDEX idx_artifact_engagement ON misir.artifact (engagement_level);

-- HNSW index for vector similarity search
CREATE INDEX idx_artifact_embedding ON misir.artifact
    USING hnsw (content_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Unique per user+normalised URL so upsert-by-URL is safe
CREATE UNIQUE INDEX idx_artifact_user_url ON misir.artifact (user_id, normalized_url);

-- =============================================================================
-- ARTIFACT EVENTS + TAGS
-- =============================================================================

CREATE TABLE misir.artifact_open_event (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id BIGINT NOT NULL REFERENCES misir.artifact (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_open_event_artifact ON misir.artifact_open_event (artifact_id);
CREATE INDEX idx_open_event_user_time ON misir.artifact_open_event (user_id, opened_at DESC);

CREATE TABLE misir.artifact_tag (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id BIGINT NOT NULL REFERENCES misir.artifact (id) ON DELETE CASCADE,
    tag         TEXT NOT NULL,
    UNIQUE (artifact_id, tag)
);

CREATE INDEX idx_tag_artifact ON misir.artifact_tag (artifact_id);
CREATE INDEX idx_tag_text ON misir.artifact_tag (tag);

-- =============================================================================
-- DEADLINES
-- =============================================================================

CREATE TABLE misir.deadline (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    space_id    BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    label       TEXT NOT NULL,              -- "Wavemaker", "Demo Day", etc.
    due_at      TIMESTAMPTZ NOT NULL,
    target_pct  INT NOT NULL DEFAULT 80,   -- readiness target %
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, space_id)             -- one active deadline per space
);

CREATE INDEX idx_deadline_space ON misir.deadline (space_id);

-- =============================================================================
-- GAPS
-- =============================================================================

CREATE TABLE misir.gap (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id            BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    -- Optional subspace scoping so a gap can point at the exact area it concerns
    -- (KnowledgeGaps renders a subspace tag + a subspace-scoped "Investigate").
    subspace_id         BIGINT REFERENCES misir.subspace (id) ON DELETE SET NULL,
    severity            misir.gap_severity NOT NULL DEFAULT 'Medium',
    label               TEXT NOT NULL,
    action              TEXT,
    status              misir.gap_status NOT NULL DEFAULT 'open',
    recurring_count     INT NOT NULL DEFAULT 1,
    gap_text_embedding  vector(768),
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_space ON misir.gap (space_id);
CREATE INDEX idx_gap_subspace ON misir.gap (subspace_id);
CREATE INDEX idx_gap_status ON misir.gap (status);
CREATE INDEX idx_gap_severity ON misir.gap (severity);

-- HNSW index for gap text embedding (cross-space link discovery)
CREATE INDEX idx_gap_embedding ON misir.gap
    USING hnsw (gap_text_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- NUDGES
-- =============================================================================

CREATE TABLE misir.nudge (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    space_id            BIGINT REFERENCES misir.space (id) ON DELETE CASCADE,
    scatter             TEXT NOT NULL,
    direction           TEXT NOT NULL,
    consequence         TEXT,
    cta_label           TEXT,
    cta_href            TEXT,
    priority            INT NOT NULL DEFAULT 1,
    status              misir.nudge_status NOT NULL DEFAULT 'active',
    evidence_data       JSONB NOT NULL DEFAULT '{}',
    requires_deadline   BOOLEAN NOT NULL DEFAULT false,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    dismissed_at        TIMESTAMPTZ,
    -- When the user last viewed the notifications list. NULL = unseen (unread).
    seen_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nudge_user ON misir.nudge (user_id);
CREATE INDEX idx_nudge_user_status ON misir.nudge (user_id, status);
CREATE INDEX idx_nudge_space ON misir.nudge (space_id);

-- =============================================================================
-- CROSS-SPACE LINKS
-- =============================================================================

CREATE TABLE misir.cross_space_link (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    source_artifact_id  BIGINT NOT NULL REFERENCES misir.artifact (id) ON DELETE CASCADE,
    target_gap_id       BIGINT NOT NULL REFERENCES misir.gap (id) ON DELETE CASCADE,
    similarity          FLOAT NOT NULL,
    status              misir.cross_link_status NOT NULL DEFAULT 'suggested',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_artifact_id, target_gap_id)
);

CREATE INDEX idx_cross_link_user ON misir.cross_space_link (user_id);
CREATE INDEX idx_cross_link_artifact ON misir.cross_space_link (source_artifact_id);
CREATE INDEX idx_cross_link_gap ON misir.cross_space_link (target_gap_id);

-- =============================================================================
-- SOURCE SYNTHESIS (per-artifact LLM extraction, gated on engagement)
-- =============================================================================

CREATE TABLE misir.source_synthesis (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id         BIGINT NOT NULL UNIQUE REFERENCES misir.artifact (id) ON DELETE CASCADE,
    top_insight         TEXT,
    -- themes: [{text, supporting_artifact_ids[], raw_relevance}]
    themes              JSONB NOT NULL DEFAULT '[]',
    unique_signal       TEXT,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_synthesis_artifact ON misir.source_synthesis (artifact_id);

-- =============================================================================
-- STAGE A CACHE — per-space summaries
-- =============================================================================

CREATE TABLE misir.space_summary (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id        BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    period          misir.report_period NOT NULL,
    source_hash     TEXT NOT NULL,
    -- Stage A payload (schema-validated JSON from synthesis_service.py)
    -- {space_id, headline, key_findings[], open_questions[], patterns[], top_platforms[]}
    payload         JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (space_id, period)
);

CREATE INDEX idx_space_summary_space ON misir.space_summary (space_id);
CREATE INDEX idx_space_summary_hash ON misir.space_summary (source_hash);

-- =============================================================================
-- STAGE B CACHE — dashboard report payloads
-- =============================================================================

CREATE TABLE misir.report (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    space_id        BIGINT NOT NULL REFERENCES misir.space (id) ON DELETE CASCADE,
    kind            misir.report_kind NOT NULL,
    period          misir.report_period NOT NULL,
    source_hash     TEXT NOT NULL,
    payload         JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, space_id, kind, period)
);

CREATE INDEX idx_report_user_space ON misir.report (user_id, space_id);
CREATE INDEX idx_report_hash ON misir.report (source_hash);

-- =============================================================================
-- CHAT
-- =============================================================================

CREATE TABLE misir.chat_conversation (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    space_id    BIGINT REFERENCES misir.space (id) ON DELETE SET NULL,
    title       TEXT,
    archived_at TIMESTAMPTZ,
    -- When the user last opened this conversation. Unread = updated_at is newer.
    last_read_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_user ON misir.chat_conversation (user_id);
CREATE INDEX idx_conversation_updated ON misir.chat_conversation (user_id, updated_at DESC);

CREATE TABLE misir.chat_message (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES misir.chat_conversation (id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'misir')),
    content         TEXT NOT NULL,
    context_hash    TEXT,
    token_count     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_conversation ON misir.chat_message (conversation_id);
CREATE INDEX idx_message_created ON misir.chat_message (conversation_id, created_at ASC);

-- =============================================================================
-- BROWSING SESSIONS (lightweight grouping)
-- =============================================================================

CREATE TABLE misir.session (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_session_user ON misir.session (user_id);

-- =============================================================================
-- UPDATED_AT TRIGGER (applied to key tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION misir.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auth_user_updated
    BEFORE UPDATE ON misir.auth_user
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_profile_updated
    BEFORE UPDATE ON misir.profile
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_space_updated
    BEFORE UPDATE ON misir.space
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_subspace_updated
    BEFORE UPDATE ON misir.subspace
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_artifact_updated
    BEFORE UPDATE ON misir.artifact
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_gap_updated
    BEFORE UPDATE ON misir.gap
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_nudge_updated
    BEFORE UPDATE ON misir.nudge
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_source_synthesis_updated
    BEFORE UPDATE ON misir.source_synthesis
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_deadline_updated
    BEFORE UPDATE ON misir.deadline
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

CREATE TRIGGER trg_conversation_updated
    BEFORE UPDATE ON misir.chat_conversation
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Channel grouping view: renders actual platforms used as "sources" for Comparison tab
CREATE VIEW misir.v_artifact_by_channel AS
SELECT
    a.user_id,
    a.space_id,
    a.platform,
    COUNT(*)                        AS artifact_count,
    AVG(a.base_weight)              AS avg_base_weight,
    MAX(a.captured_at)              AS last_captured_at
FROM misir.artifact a
GROUP BY a.user_id, a.space_id, a.platform;

-- Revisit count helper: drives revisit badge in ActivityTimeline
CREATE VIEW misir.v_artifact_revisit AS
SELECT
    aoe.artifact_id,
    aoe.user_id,
    COUNT(*)                        AS open_count,
    MAX(aoe.opened_at)              AS last_opened_at
FROM misir.artifact_open_event aoe
GROUP BY aoe.artifact_id, aoe.user_id;

-- =============================================================================
-- CONSENT + AUDIT (privacy & data-rights — see privacy_migration.sql)
-- =============================================================================

CREATE TYPE misir.consent_purpose AS ENUM (
    'web_capture', 'ai_chat_capture', 'analytics', 'marketing'
);

-- Per-(user,purpose) affirmative, versioned consent that GATES all collection
-- (GDPR Art 6/7, ePrivacy Art 5(3), CCPA opt-in for sensitive PI, BD PDPO).
CREATE TABLE misir.consent (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    purpose         misir.consent_purpose NOT NULL,
    granted         BOOLEAN NOT NULL DEFAULT false,
    jurisdiction    TEXT,
    policy_version  TEXT,
    source          TEXT,                       -- 'frontend' | 'extension'
    gpc             BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, purpose)
);

CREATE INDEX idx_consent_user ON misir.consent (user_id);

CREATE TRIGGER trg_consent_updated
    BEFORE UPDATE ON misir.consent
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

-- Append-only audit of privacy-sensitive events. user_id SET NULL on account
-- deletion so proof of deletion survives (GDPR Art 5(2) accountability).
CREATE TABLE misir.audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES misir.auth_user (id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    detail      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user_time ON misir.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_action ON misir.audit_log (action);

-- Storage-limitation purge (GDPR 5(1)(e), CCPA, BD). Run via pg_cron or the
-- backend retention_service. See privacy_migration.sql for the pg_cron schedule.
CREATE OR REPLACE FUNCTION misir.purge_expired_data(retention_days INT DEFAULT 400)
RETURNS TABLE(artifacts_deleted BIGINT, gaps_deleted BIGINT, nudges_deleted BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
    cutoff TIMESTAMPTZ := now() - make_interval(days => retention_days);
    a_del BIGINT; g_del BIGINT; n_del BIGINT;
BEGIN
    WITH d AS (DELETE FROM misir.artifact WHERE captured_at < cutoff RETURNING 1)
        SELECT count(*) INTO a_del FROM d;
    WITH d AS (DELETE FROM misir.gap WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at < cutoff RETURNING 1)
        SELECT count(*) INTO g_del FROM d;
    WITH d AS (DELETE FROM misir.nudge WHERE status IN ('dismissed','acted') AND dismissed_at IS NOT NULL AND dismissed_at < cutoff RETURNING 1)
        SELECT count(*) INTO n_del FROM d;
    RETURN QUERY SELECT a_del, g_del, n_del;
END $$;

-- =============================================================================
-- GRANT service_role full access to misir schema
-- (Supabase service_role bypasses RLS; backend uses this role exclusively)
-- =============================================================================

GRANT USAGE ON SCHEMA misir TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA misir TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA misir TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA misir TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA misir
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA misir
    GRANT ALL ON SEQUENCES TO service_role;
