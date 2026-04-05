-- God Mode super-admin role (spec 15)
ALTER TABLE players ADD COLUMN is_god_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Grant God Mode to Karthik Rajan
UPDATE players
SET is_god_mode = TRUE
WHERE name = 'Karthik Rajan'
  AND email ILIKE '%@gmail.com';
