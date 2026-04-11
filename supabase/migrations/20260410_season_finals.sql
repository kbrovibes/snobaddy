-- Spec 27: Season Finals — Foundation Tables
-- Additive only. No existing tables or columns are modified beyond new nullable/defaulted additions.
-- All existing sessions get session_type = 'regular'. All existing matches get match_type = 'regular'.

-- ─────────────────────────────────────────────────────────
-- 1. finals_events
--    One per season. Tracks the overall Finals planning state.
-- ─────────────────────────────────────────────────────────
CREATE TABLE finals_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id           uuid NOT NULL REFERENCES seasons(id) UNIQUE,
  name                text NOT NULL DEFAULT 'Season Finals',
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft',
                          'breakdown_generated',
                          'sessions_created',
                          'active',
                          'completed'
                        )),
  finals1_session_id  uuid,  -- set after generate-sessions; FK added below to avoid circular ref
  finals2_session_id  uuid,  -- set after generate-sessions; FK added below
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES players(id)
);

-- ─────────────────────────────────────────────────────────
-- 2. Add session_type + finals_event_id to sessions
--    Must happen before adding FK from finals_events → sessions.
-- ─────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN session_type    text NOT NULL DEFAULT 'regular'
               CHECK (session_type IN ('regular', 'finals')),
  ADD COLUMN finals_event_id uuid REFERENCES finals_events(id);

-- Now add the deferred FKs from finals_events back to sessions
ALTER TABLE finals_events
  ADD CONSTRAINT finals_events_finals1_session_id_fkey
    FOREIGN KEY (finals1_session_id) REFERENCES sessions(id),
  ADD CONSTRAINT finals_events_finals2_session_id_fkey
    FOREIGN KEY (finals2_session_id) REFERENCES sessions(id);

-- ─────────────────────────────────────────────────────────
-- 3. finals_participants
--    One row per player in the Finals pool.
--    Stats snapshot taken at breakdown time.
-- ─────────────────────────────────────────────────────────
CREATE TABLE finals_participants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finals_event_id     uuid NOT NULL REFERENCES finals_events(id) ON DELETE CASCADE,
  player_id           uuid NOT NULL REFERENCES players(id),

  -- Group assignment
  group_label         text CHECK (group_label IN ('A', 'B', 'C')),
  finals_day          int  CHECK (finals_day IN (1, 2)),  -- derived: A+B→1, C→2

  -- Stats snapshot at breakdown time (for explanation & auditability)
  skill_level         int,
  season_win_rate     numeric(5,2),  -- e.g. 62.50
  season_wins         int,
  season_losses       int,
  finals_score        numeric(6,2),  -- composite 0–100
  score_breakdown     jsonb,         -- { "skill": 37.50, "win_rate": 31.00 }
  score_explanation   text,          -- Human-readable one-liner shown in admin UI

  -- Override tracking
  group_override      boolean NOT NULL DEFAULT false,

  -- Metadata
  added_at            timestamptz NOT NULL DEFAULT now(),
  added_by            uuid REFERENCES players(id),

  UNIQUE (finals_event_id, player_id)
);

-- ─────────────────────────────────────────────────────────
-- 4. Add match_type + finals_group to matches
-- ─────────────────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN match_type   text NOT NULL DEFAULT 'regular'
               CHECK (match_type IN (
                 'regular',
                 'finals_group',   -- group-stage match (both formats)
                 'finals_final'    -- game within a Best-of-3 series (playoffs only)
               )),
  ADD COLUMN finals_group text       -- 'A' or 'B'; null for regular matches
               CHECK (finals_group IN ('A', 'B'));

-- ─────────────────────────────────────────────────────────
-- 5. Indexes
-- ─────────────────────────────────────────────────────────
CREATE INDEX idx_finals_participants_event  ON finals_participants(finals_event_id);
CREATE INDEX idx_finals_participants_player ON finals_participants(player_id);
CREATE INDEX idx_sessions_finals_event      ON sessions(finals_event_id) WHERE finals_event_id IS NOT NULL;
CREATE INDEX idx_matches_match_type         ON matches(match_type) WHERE match_type != 'regular';
