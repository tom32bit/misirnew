-- =============================================================================
-- Read-state migration
-- =============================================================================
-- Replaces the timestamp-based unread approximation with real, persisted read
-- state: when the user last opened a conversation, and when a nudge was seen.
-- Additive + nullable + idempotent — safe to run on a live DB.

-- Conversation: last time the user opened it. Unread = updated_at > last_read_at.
ALTER TABLE misir.chat_conversation
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Nudge: when the user last viewed the notifications list. NULL = unseen.
ALTER TABLE misir.nudge
    ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

-- Schema-drift repair: the live nudge table was missing updated_at, but the
-- trg_nudge_updated BEFORE UPDATE trigger references NEW.updated_at — so EVERY
-- update to a nudge (mark-seen, dismiss, act) failed with 42703
-- "record new has no field updated_at". Add the column the trigger expects.
ALTER TABLE misir.nudge
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
