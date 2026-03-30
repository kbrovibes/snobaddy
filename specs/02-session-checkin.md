# Spec 02: Session & Check-In

## What it does
When someone opens the app on a session day (Monday or Thursday), it shows tonight's session.
Players can be checked in as they arrive. The session view shows who is currently here.
A session is automatically created for today if one doesn't exist yet.

## What it does NOT do
- No check-out tracking (presence is binary — here or not here tonight)
- No time-of-arrival tracking
- No admin approval to start a session — anyone opening the app can start it
- No historical session browsing (yet)

## Data

### Table: `sessions`
```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  created_at timestamptz default now()
);
```

### Table: `session_players`
```sql
create table session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  player_id uuid references players(id),
  checked_in_at timestamptz default now(),
  unique(session_id, player_id)
);
```

## UI
- `/session/today` — redirects to `/session/[id]` for today's session (creates it if needed)
- `/session/[id]` — the main session view
  - Header: day + date (e.g. "Monday, Apr 7")
  - "Who's here" section: chips/badges for each checked-in player showing name + skill level
  - "Check in a player" — searchable dropdown of all players not yet checked in + Check In button
  - Player count shown (e.g. "8 players tonight")

## API
- `GET /api/sessions/today` — returns today's session (creates it if it doesn't exist)
- `POST /api/sessions/[id]/checkin` — body: `{ player_id }` — checks a player into the session

## Acceptance Criteria
- [ ] Opening `/session/today` always lands on the correct session for today
- [ ] Session is auto-created on first visit — no manual setup needed
- [ ] Can check in a player from the dropdown
- [ ] Checked-in players appear immediately
- [ ] Can't check in the same player twice
- [ ] Shows total count of players present
- [ ] Works on mobile
