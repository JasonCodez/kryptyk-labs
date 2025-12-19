-- =========================================================
-- KRYPTYK LABS — ACCESS KEYS RESET SUPPORT
-- Adds kind + used_at so password reset keys can be stored
-- alongside signup access keys without breaking existing flows.
-- Idempotent / safe to run multiple times.
-- =========================================================

BEGIN;

-- Ensure enum type exists and includes required labels.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_key_kind') THEN
    CREATE TYPE access_key_kind AS ENUM ('signup', 'reset');
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'access_key_kind'
        AND e.enumlabel = 'signup'
    ) THEN
      ALTER TYPE access_key_kind ADD VALUE 'signup';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'access_key_kind'
        AND e.enumlabel = 'reset'
    ) THEN
      ALTER TYPE access_key_kind ADD VALUE 'reset';
    END IF;
  END IF;
END $$;

-- Ensure columns exist.
ALTER TABLE access_keys
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Add kind with a default so existing rows are treated as signup keys.
ALTER TABLE access_keys
  ADD COLUMN IF NOT EXISTS kind access_key_kind NOT NULL DEFAULT 'signup';

-- Ensure email exists (older schemas sometimes omitted it).
ALTER TABLE access_keys
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email where possible.
UPDATE access_keys ak
SET email = COALESCE(ak.email, u.email)
FROM users u
WHERE ak.user_id = u.id
  AND (ak.email IS NULL OR btrim(ak.email) = '');

-- If there are still NULL emails, keep them allowed (legacy rows);
-- new inserts should always include email.

CREATE INDEX IF NOT EXISTS idx_access_keys_email_kind_used
  ON access_keys (email, kind, used);

COMMIT;
