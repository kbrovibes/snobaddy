-- Season lifecycle: add status column for active/upcoming/completed states
-- See specs/34-season-lifecycle.md for full spec

ALTER TABLE seasons ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'upcoming', 'completed'));

-- Enforce at most one active season at any time
CREATE UNIQUE INDEX idx_seasons_one_active
  ON seasons ((1)) WHERE status = 'active';
