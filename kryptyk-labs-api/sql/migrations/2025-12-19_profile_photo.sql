-- =========================================================
-- KRYPTYK LABS — PROFILE PHOTO SUPPORT
-- Adds a per-user stored profile photo path.
-- =========================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;

COMMIT;
