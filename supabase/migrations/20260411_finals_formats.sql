-- Task 6: Finals Format Selection
-- One row per Finals Session, storing the chosen format and its configuration.

CREATE TABLE finals_formats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES sessions(id) UNIQUE,
  format_type  text NOT NULL CHECK (format_type IN ('playoffs', 'fixed_partner')),
  status       text NOT NULL DEFAULT 'configured'
                 CHECK (status IN ('configured', 'matches_generated', 'playoffs_complete', 'completed')),
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finals_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON finals_formats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
