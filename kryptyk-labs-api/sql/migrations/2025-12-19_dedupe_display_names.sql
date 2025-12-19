-- Resolve existing duplicate display_name values so a unique constraint can be enforced.
-- Strategy: keep the earliest-created user (tie-breaker: lowest id) and clear display_name
-- for all other users with the same name (case-insensitive, trimmed).

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(btrim(display_name))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM users
  WHERE display_name IS NOT NULL
    AND btrim(display_name) <> ''
)
UPDATE users u
SET display_name = NULL
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;
