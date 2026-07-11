-- =============================================================================
-- Subspace propagation migration
-- =============================================================================
-- Adds subspace_id to artifact and gap so the extension's on-device subspace
-- match is persisted, and gaps can be scoped to a subspace. Safe to run on a
-- live DB: additive, nullable, ON DELETE SET NULL. Idempotent via IF NOT EXISTS.

-- Artifact: the specific subspace the extension matched (nullable — a capture
-- can match a space without a confident subspace, or no space at all).
ALTER TABLE misir.artifact
    ADD COLUMN IF NOT EXISTS subspace_id BIGINT REFERENCES misir.subspace (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_artifact_subspace ON misir.artifact (subspace_id);

-- Gap: optional subspace scoping for the "Investigate" deep-link + subspace tag.
ALTER TABLE misir.gap
    ADD COLUMN IF NOT EXISTS subspace_id BIGINT REFERENCES misir.subspace (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gap_subspace ON misir.gap (subspace_id);
