# Spec 03: Record a Match

## What it does
From the session view, anyone can record a completed match.
Pick 4 checked-in players, split them into 2 teams, tap the winning team.
The result is saved and W/L counts update immediately on the session scoreboard.

## What it does NOT do
- No court assignment (we have 2 courts but don't track which is which yet)
- No score tracking (e.g. 21-15) — just win/loss
- No "in progress" match state — matches are recorded after they finish
- No undo (yet)

## Data

### Table: `matches`
```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  team1_player1_id uuid references players(id),
  team1_player2_id uuid references players(id),
  team2_player1_id uuid references players(id),
  team2_player2_id uuid references players(id),
  winning_team integer not null check (winning_team in (1, 2)),
  played_at timestamptz default now()
);
```

## UI
- "Record Match" button on the session view → opens a form (modal or inline)
  - Step 1: Pick 4 players from checked-in players (multi-select, shows skill levels)
  - Step 2: Assign to Team 1 / Team 2 (drag or simple toggle)
  - Step 3: Tap "Team 1 Won" or "Team 2 Won"
  - Confirm → saved → form closes
- Below the check-in section: match history for tonight (list of matches, newest first)
  - Each match shows: Team 1 vs Team 2, winner highlighted, time played

## Session Scoreboard (also on session view)
Table of checked-in players sorted by wins (desc), showing:
- Name, Skill, W, L, Win%

## API
- `POST /api/matches` — body: `{ session_id, team1: [id, id], team2: [id, id], winning_team: 1|2 }`
- `GET /api/sessions/[id]/matches` — all matches for a session with player names

## Acceptance Criteria
- [ ] Can pick 4 players and assign to 2 teams
- [ ] Can't pick the same player twice
- [ ] Tapping a winner saves the match
- [ ] Session scoreboard updates immediately after recording
- [ ] Match appears in tonight's match history
- [ ] Works on mobile — big tap targets for winner selection
