-- Non-destructive migration: add mission_completions for server-authoritative progression

CREATE TABLE IF NOT EXISTS mission_completions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL,
  success      BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_completions_user_success
  ON mission_completions (user_id, success);
