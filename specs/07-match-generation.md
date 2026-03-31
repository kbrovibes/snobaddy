# Spec 07 — Match Generation

**Owner:** @kbrovibes  
**Status:** 📝 Draft  
**Version:** 0.1.0  
**Feature:** Proposed match algorithm for active sessions.

## 1. Problem
Currently, players and admins have to manually decide who should play together. With 30–50 players per session and 2 courts, it can be difficult to:
- Balance teams based on skill level (1–5)
- Ensure everyone gets a fair number of games
- Avoid repetitive matchups
- Manage a waiting queue efficiently

## 2. Goals
- Provide an automated "Match Suggester" that proposes fair 4-player matchups.
- Allow both **admins and regular users** to generate suggestions.
- Support a queue of up to **four proposed matches** at a time.
- Use an algorithm that considers player presence, skill levels, and recent play history.

## 3. User Experience

### Suggestion Interface
- A "Suggest Matches" button on the active session page.
- A list of **Proposed Matches** (Queue) showing:
    - Team 1 vs Team 2 (First names)
    - Calculated "Fairness" score or Skill average
    - A "Record Result" shortcut button for each proposed match.

### Permissions
- **Regular Users:** Can trigger the suggestion algorithm and view the proposed queue.
- **Admins:** Can additionally clear the queue or manually override suggestions (if needed).

## 4. Technical Requirements

### The Queue
- Proposed matches are **temporary** and stored in the database (new table `proposed_matches` or similar).
- Max limit: **4 matches** in the queue.
- Proposed matches are cleared when the session is closed.

### The Algorithm (Placeholder)
The algorithm will be a complex function that ranks potential 4-player combinations based on guidelines to be provided.

## 5. Constraints & Guidelines (The Algorithm)
The algorithm should evaluate the pool of checked-in players and propose matches based on these prioritized rules:

1.  **Anti-Back-to-Back (Highest Priority):** Prioritize players who were NOT in the most recent 1–2 recorded matches. The system must actively try to avoid scheduling the same player in two consecutive matches. If a conflict arises, avoiding back-to-back play takes precedence over team balance.
2.  **Team Balance & Sanity Check:** 
    *   Combined skill level of Team 1 should be as close as possible to the combined skill level of Team 2.
    *   **Sanity Rule:** Avoid extreme skill gaps (e.g., three Skill 5s and one Skill 1). The algorithm must ensure a "reasonable" spread where no single player is completely outclassed or dominant beyond a fair threshold.
3.  **Diversity & Variety:** Prioritize pairings that haven't played together recently in this session to ensure a wide, diverse set of matches.
4.  **Skill Mixing (Early Session):** Encourage lower-skill players to pair with higher-skilled players during the first few games of the night (average matches < 2.0).
5.  **Skill Convergence (Late Session):** As the session progresses (average matches >= 2.0), prioritize matches where all 4 players are of similar skill levels, while maintaining internal team balance.

## 6. User Experience & Workflow

### Queue Management
- **Generate Action:** A "🏸 Suggest Matches" button triggers the algorithm to fill the **delta** up to a maximum of 4 proposed matches.
- **Persistence:** All generated match recommendations are saved to the `proposed_matches` table.
- **Manual Deletion:** Each proposed match has a "Delete" button. Deleting a match does **not** auto-backfill; the slot remains empty until "Suggest Matches" is clicked again.
- **Manual Record:** Each proposed match has a "Record Score" button that opens the match form pre-filled with the 4 players.

### Match Selection & Recording
- The existing manual "Record a Match" button remains for flexibility.
- Once a proposed match is converted into a real match (score saved), it is removed from the `proposed_matches` table.


## 7. Success Criteria
- [ ] New database table created for `proposed_matches`.
- [ ] Algorithm implementation that respects skill balance and player history.
- [ ] "Record Match" UI updated to show proposed matches as selectable options.
- [ ] Manual "Record Match" still works as before.
- [ ] Recommendations can be deleted.

