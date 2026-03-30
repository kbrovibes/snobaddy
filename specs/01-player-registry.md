# Spec 01: Player Registry

## What it does
A page at `/players` showing all players who have ever signed in and completed onboarding.
This is a read-only directory — players are created automatically via Google login (spec 00),
not manually added here.

## What it does NOT do
- No manual player creation (handled by auth onboarding)
- No editing skill levels (yet)
- No deleting players

## UI
- `/players` — accessible from nav after login
  - Header: "Players"
  - List of all players sorted alphabetically
  - Each row: name, skill level (shown as filled dots ●●●○○), email
  - Shows total player count
  - No add/edit controls

## API
- `GET /api/players` — returns all players with onboarding_complete = true, ordered by name

## Acceptance Criteria
- [ ] `/players` lists all onboarded players
- [ ] Skill level shown visually, not just a number
- [ ] Requires login to view
- [ ] Works on mobile
