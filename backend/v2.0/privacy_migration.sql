-- =============================================================================
-- Misir v2.0 — Privacy & data-rights migration (idempotent)
-- Adds: consent ledger, audit log, retention purge (pg_cron optional).
-- Apply to existing databases. Fresh installs get these from schema.sql too.
-- Run as a role with privileges on schema "misir".
-- =============================================================================

SET search_path TO misir, public;

-- ── consent purpose enum ─────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'consent_purpose' AND n.nspname = 'misir'
    ) THEN
        CREATE TYPE misir.consent_purpose AS ENUM (
            'web_capture', 'ai_chat_capture', 'analytics', 'marketing'
        );
    END IF;
END $$;

-- ── consent ledger ───────────────────────────────────────────────────────────
-- One row per (user, purpose). Records the affirmative, per-purpose, versioned
-- consent that gates all collection (GDPR Art 6/7, ePrivacy Art 5(3),
-- CCPA opt-in for sensitive PI, BD PDPO explicit consent).
CREATE TABLE IF NOT EXISTS misir.consent (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES misir.auth_user (id) ON DELETE CASCADE,
    purpose         misir.consent_purpose NOT NULL,
    granted         BOOLEAN NOT NULL DEFAULT false,
    jurisdiction    TEXT,                       -- 'EU' | 'US' | 'BD' | ...
    policy_version  TEXT,                       -- privacy-policy version consented to
    source          TEXT,                       -- 'frontend' | 'extension'
    gpc             BOOLEAN NOT NULL DEFAULT false,  -- Global Privacy Control signal seen
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON misir.consent (user_id);

-- ── audit log ────────────────────────────────────────────────────────────────
-- Append-only record of privacy-sensitive events (consent changes, exports,
-- erasures, captures). user_id is SET NULL on account deletion so the proof of
-- deletion survives (GDPR Art 5(2) accountability). Detail avoids storing
-- raw personal data.
CREATE TABLE IF NOT EXISTS misir.audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES misir.auth_user (id) ON DELETE SET NULL,
    action      TEXT NOT NULL,                  -- 'consent.update' | 'account.export' | 'account.delete' | 'artifact.capture' | ...
    detail      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time ON misir.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON misir.audit_log (action);

-- ── updated_at trigger for consent ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_consent_updated ON misir.consent;
CREATE TRIGGER trg_consent_updated
    BEFORE UPDATE ON misir.consent
    FOR EACH ROW EXECUTE FUNCTION misir.set_updated_at();

-- ── grants (service_role) ────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON misir.consent TO service_role;
GRANT ALL PRIVILEGES ON misir.audit_log TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA misir TO service_role;

-- ── retention purge (storage limitation — GDPR 5(1)(e), CCPA, BD) ────────────
-- Deletes artifacts (and, via FK cascade, their synthesis/embeddings/events/
-- tags/links) older than the retention window. Resolved gaps and dismissed
-- nudges past the window are also purged. The window MUST match the value
-- published in the privacy policy and the backend's RETENTION_DAYS setting.
--
-- Primary path: pg_cron (DB-side, no app process needed). Requires the pg_cron
-- extension and that the job interval matches RETENTION_DAYS. Adjust '400 days'
-- to your published retention period.
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

GRANT EXECUTE ON FUNCTION misir.purge_expired_data(INT) TO service_role;

-- Schedule daily at 03:00 UTC if pg_cron is installed (no-op otherwise).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('misir-retention-purge')
            WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'misir-retention-purge');
        PERFORM cron.schedule(
            'misir-retention-purge', '0 3 * * *',
            $cron$ SELECT misir.purge_expired_data(400); $cron$
        );
    END IF;
END $$;
