-- =========================================================
-- KRYPTYK LABS — SECURITY QUESTION RESET SUPPORT
-- Stores a per-user security question + answer hash.
-- =========================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS security_question TEXT,
  ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;

COMMIT;
