# Spec 01: Player Registry

## What it does
A page at `/players` that shows all players ever added to the system.
Anyone can add a new player by typing their name and selecting a skill level (1–5).
Players are permanent records — they persist across all sessions and seasons.

## What it does NOT do
- No editing or deleting players (yet)
- No login — anyone can add a player
- No duplicate prevention beyond a unique name constraint in the DB
- No importing from an existing list

## Data

### Table: `players`
```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  skill_level integer not null check (skill_level between 1 and 5),
  created_at timestamptz default now()
);
```

## UI
- `/players` — full page
  - Header: "Players"
  - List of all players, sorted alphabetically, showing name + skill level (shown as filled dots ●●●○○ or similar)
  - "Add Player" form at the bottom or in a modal: name (text input) + skill level (1–5 selector) + Save button
  - After save, list refreshes to show the new player

## API
- `GET /api/players` — returns all players ordered by name
- `POST /api/players` — creates a player, body: `{ name, skill_level }`

## Acceptance Criteria
- [ ] `/players` page loads and shows all existing players
- [ ] Can add a new player with name + skill level
- [ ] New player appears in the list immediately after save
- [ ] Skill level is visually shown (not just a number)
- [ ] Duplicate name returns a clear error message
- [ ] Works on mobile (phone screen at the court)
