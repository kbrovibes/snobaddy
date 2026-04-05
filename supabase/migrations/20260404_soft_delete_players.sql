-- Soft-delete support for players (spec 06)
ALTER TABLE players ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for the common "active players only" filter
CREATE INDEX players_deleted_at_idx ON players (deleted_at) WHERE deleted_at IS NULL;
