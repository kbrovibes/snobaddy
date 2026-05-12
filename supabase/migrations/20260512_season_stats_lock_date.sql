-- Moves stats lock date from per-session to per-season.
-- A single date on the season; sessions after this date are excluded from the leaderboard.
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS stats_lock_date DATE NULL;
