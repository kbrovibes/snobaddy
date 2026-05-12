-- Adds stats_lock_date to sessions.
-- When set, session data is excluded from the leaderboard after this date.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS stats_lock_date DATE NULL;
