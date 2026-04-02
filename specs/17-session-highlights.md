# Spec 17: Session Highlights

## What it does
When a session is closed, the session detail page shows a row of award cards at the top of the completed view — before the scoreboard. Each card calls out one player (or team) for a standout stat from that session.

Admin-only for now (will be shown to all after testing).

## What it does NOT do
- No roast or negative cards
- No notifications or push
- Does not persist to DB — computed on the fly from match data
- Not shown during active sessions

## Awards (5 total)

| # | Name | Emoji | Winner criteria |
|---|------|-------|----------------|
| 1 | The Sultan | 👑 | Most wins |
| 2 | Iron Shuttle | 🦾 | Most matches played |
| 3 | The Untouchable | 🧊 | Best win rate (min 3 matches) |
| 4 | The Cannon | 💥 | Most total points scored across all matches |
| 5 | No Mercy | 😤 | Biggest single-match margin of victory (team award — both players named) |

If fewer than 3 total matches were played this session, skip the highlights section entirely.

Tie-breaking: alphabetical by name (deterministic, no hidden bias).

## Data / DB changes
No schema changes. All data comes from the existing `matches` table.

## API
No new API routes. Data is fetched server-side in the session page.

## UI

Horizontal scroll row of cards, shown at top of the `isCompleted` section (above the scoreboard). Each card:

```
┌─────────────────────┐
│  👑                  │
│  The Sultan          │
│  Karthik             │
│  5 wins              │
└─────────────────────┘
```

- Fixed width (~140px), rounded card, shadow
- Emoji large (2xl), award name small + muted, player name bold, stat line small + muted
- Horizontal scroll with `overflow-x-auto` — works on mobile
- No mercy card shows two names: "Karthik & Swathi"

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/db/matches.ts` | Add `getSessionHighlights(sessionId)` |
| `src/components/SessionHighlights.tsx` | Create — award cards row |
| `src/app/(app)/session/[id]/page.tsx` | Call highlights query; render `<SessionHighlights>` at top of completed block |

## Acceptance Criteria
- [ ] Cards appear only when session is completed
- [ ] Cards appear only when `isAdmin` is true
- [ ] Section is hidden entirely if fewer than 3 matches were played
- [ ] Each award shows correct winner based on match data
- [ ] No Mercy card shows both team players
- [ ] Cards scroll horizontally on mobile
