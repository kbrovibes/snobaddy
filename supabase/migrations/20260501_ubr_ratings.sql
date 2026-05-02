-- UBR (Universal Badminton Rating) tables
-- See docs/ubr-algorithm.md for full algorithm specification

-- Current cached ratings (one row per player)
CREATE TABLE IF NOT EXISTS ubr_ratings (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  rating NUMERIC(8,2) NOT NULL DEFAULT 2500,
  rating_deviation NUMERIC(6,2) NOT NULL DEFAULT 350,
  match_count INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Bronze',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-session rating history (for progression charts)
CREATE TABLE IF NOT EXISTS ubr_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  rating_before NUMERIC(8,2) NOT NULL,
  rating_after NUMERIC(8,2) NOT NULL,
  rating_change NUMERIC(8,2) NOT NULL,
  match_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_ubr_history_player ON ubr_history(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ubr_history_session ON ubr_history(session_id);
