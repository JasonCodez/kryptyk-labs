-- ===== RESET OLD TABLES (safe to run multiple times) =====
DROP TABLE IF EXISTS mission_completions CASCADE;
DROP TABLE IF EXISTS asset_access_logs CASCADE;
DROP TABLE IF EXISTS asset_logs CASCADE;
DROP TABLE IF EXISTS access_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS access_key_kind;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE users (
  id                     SERIAL PRIMARY KEY,
  email                  TEXT NOT NULL UNIQUE,
  password_hash          TEXT,                          -- nullable (set on complete-signup)
  display_name           TEXT,
  clearance_level        TEXT NOT NULL DEFAULT 'INITIATED',
  motto                  TEXT,
  clearance_progress_pct INTEGER NOT NULL DEFAULT 5,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at          TIMESTAMPTZ,
  is_verified            BOOLEAN NOT NULL DEFAULT FALSE,
  debrief_seen           BOOLEAN NOT NULL DEFAULT FALSE,
  debrief_seen_at        TIMESTAMPTZ
);

-- display_name must be unique across users (case-insensitive, ignoring surrounding whitespace).
-- NULL/empty values are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique
  ON users (lower(btrim(display_name)))
  WHERE display_name IS NOT NULL
    AND btrim(display_name) <> '';

-- =========================================================
-- ACCESS KEYS (signup + reset)
-- =========================================================
CREATE TYPE access_key_kind AS ENUM ('signup', 'reset');

CREATE TABLE access_keys (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,                    -- required (fixes your NULL email errors)
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL,
  kind        access_key_kind NOT NULL DEFAULT 'signup',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_access_keys_email_kind_used
  ON access_keys (email, kind, used);

-- =========================================================
-- ASSET LOGS (legacy)
-- =========================================================
CREATE TABLE asset_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_logs_user_created_at
  ON asset_logs (user_id, created_at DESC);

-- =========================================================
-- ASSET ACCESS LOGS (current; used by /api/profile/* and /api/missions/log)
-- =========================================================
CREATE TABLE asset_access_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  message     TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_access_logs_user_created_at
  ON asset_access_logs (user_id, created_at DESC);

-- =========================================================
-- MISSION COMPLETIONS (authoritative progression)
-- =========================================================
CREATE TABLE mission_completions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL,
  success      BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mission_id)
);

CREATE INDEX idx_mission_completions_user_success
  ON mission_completions (user_id, success);
