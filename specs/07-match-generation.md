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

1.  **Team Balance:** Combined skill level of Team 1 should be as close as possible to the combined skill level of Team 2.
2.  **Diversity & Variety:** Prioritize pairings that haven't played together recently to ensure a wide, diverse set of matches and minimize repetition.
3.  **Skill Mixing:** Ensure players of lower skill levels get opportunities to pair with and play against higher-skilled players early in the session.
4.  **Skill Convergence:** As the session progresses (after everyone has played a few matches), the algorithm should start grouping players of similar skill levels together in the same match while still maintaining balance between the two teams.
5.  **Persistence:** All generated match recommendations must be persisted in the database until they are either converted to a real match, deleted, or the session ends.

## 6. User Experience & Workflow

### Match Selection & Recording
- When a user goes to "Record a Match", they should see a list of the **active proposed matches**.
- Tapping a proposed match should pre-fill the match recording form with those 4 players.
- The existing **manual entry** option must remain available for matches played outside of suggestions.

### Queue Management
- Admins and users can view the queue.
- There must be an explicit option to **delete** a match recommendation from the queue.
- Max queue size: 4 matches.

## 7. Success Criteria
- [ ] New database table created for `proposed_matches`.
- [ ] Algorithm implementation that respects skill balance and player history.
- [ ] "Record Match" UI updated to show proposed matches as selectable options.
- [ ] Manual "Record Match" still works as before.
- [ ] Recommendations can be deleted.

