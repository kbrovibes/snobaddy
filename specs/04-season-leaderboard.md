# Spec 04: Season Leaderboard

## What it does
A page at `/leaderboard` showing cumulative stats for all players across the entire current season.
Anyone can view it. Updates reflect all recorded matches to date.

## What it does NOT do
- No season selection (always shows current/only season for now)
- No per-session breakdown on this page
- No prizes or highlights yet — just raw stats

## Data
No new tables. Stats are computed from `matches` + `players`.

Query logic:
- For each player: count matches where they appear in any of the 4 player slots
- Wins: matches where they were on the winning team
- Losses: matches where they were on the losing team
- Win%: wins / (wins + losses), shown as percentage

## UI
- `/leaderboard` — full page
  - Header: "Season Leaderboard"
  - Table sorted by win% (desc), with tiebreak by total matches played (desc)
  - Columns: Rank, Name, Skill, Played, W, L, Win%
  - Highlight top 3 rows (gold/silver/bronze or similar)
  - Show total matches recorded this season at the bottom

## API
- `GET /api/leaderboard` — returns player stats aggregated across all sessions

## Acceptance Criteria
- [ ] Shows all players who have played at least one match
- [ ] Stats are correct (verified against known match data)
- [ ] Sorted by win%, tiebreak by matches played
- [ ] Top 3 are visually distinct
- [ ] Win% shown as e.g. "67%" not "0.67"
- [ ] Works on mobile
