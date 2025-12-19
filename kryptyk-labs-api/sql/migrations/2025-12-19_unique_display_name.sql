-- Ensure display_name is unique across users (case-insensitive, ignoring surrounding whitespace).
-- NOTE: This is a partial unique index, so NULL/empty display_name values are allowed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE display_name IS NOT NULL
      AND btrim(display_name) <> ''
    GROUP BY lower(btrim(display_name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique display names: duplicates exist (case-insensitive / trimmed). Resolve duplicates in users.display_name first.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique
  ON users (lower(btrim(display_name)))
  WHERE display_name IS NOT NULL
    AND btrim(display_name) <> '';
