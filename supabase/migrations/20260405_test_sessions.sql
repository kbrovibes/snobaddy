-- Spec 22: Test Sessions
-- Adds is_test_session flag to sessions.
-- Existing sessions (all Mon/Thu) correctly default to false.

ALTER TABLE sessions
  ADD COLUMN is_test_session boolean NOT NULL DEFAULT false;
