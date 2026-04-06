-- Spec 21 item #2: Add missing indexes for common query patterns
-- Already applied directly to production on 2026-04-06

-- Hit on every session page load (match history, scoreboard)
CREATE INDEX IF NOT EXISTS idx_matches_session_id_played_at
  ON matches(session_id, played_at DESC);

-- Hit on every check-in fetch (Who's Here list)
CREATE INDEX IF NOT EXISTS idx_session_players_session_checked_out
  ON session_players(session_id, checked_out_at);

-- Hit on home page session list
CREATE INDEX IF NOT EXISTS idx_sessions_date_status
  ON sessions(date DESC, status);

-- Hit on leaderboard and admin page (player list queries)
CREATE INDEX IF NOT EXISTS idx_players_onboarding_deleted
  ON players(onboarding_complete, deleted_at);

-- Note: idx_players_last_seen_at skipped — last_seen_at column does not exist yet
-- Add when online indicator (Spec 09) is implemented
