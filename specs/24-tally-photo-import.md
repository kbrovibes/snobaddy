# Spec 24: Tally Photo Import

## What it does

Admins can upload a photo of the whiteboard (or any score sheet) on a completed session with tally mode enabled. The image is stored in Supabase Storage, then passed to an AI vision model (Claude or Gemini) which extracts player names and W/L counts and pre-populates the tally entry form. The admin reviews and edits the extracted entries before saving.

## What it does NOT do

- Does not automatically save tally data — extraction always produces a draft that requires admin review and an explicit save action
- Does not parse match-by-match records — only aggregate W/L per player
- Does not delete stored photos after extraction (kept for audit)
- Does not show the stored photo to non-admin users
- Does not support multiple photos per session (one upload per session; re-upload replaces)
- Does not support PDF or non-image files

---

## Two variants

### Variant A — Transient (no storage)

Upload → extract → discard. Simpler, completely free. No audit trail.

**When to use:** If image accuracy is trusted and no one needs to re-run extraction later.

### Variant B — With Supabase Storage (recommended)

Upload → store in Supabase Storage → extract → keep photo linked to session.

**Why:** Admins may want to re-check the original photo if extracted numbers look wrong. Storage is free within the 1GB Supabase free tier. For a 30-player club uploading a few photos per week, this is negligible.

**This spec implements Variant B.** Variant A is a strict subset — to degrade to transient, skip the storage step and remove the photo URL column.

---

## Data / DB changes

### New Supabase Storage bucket

```sql
-- Run in Supabase dashboard or via MCP
insert into storage.buckets (id, name, public)
values ('tally-photos', 'tally-photos', false);
```

Private bucket — files are only accessible via signed URLs generated server-side.

### New column on `sessions`

```sql
alter table sessions
  add column tally_photo_path text;
-- stores the storage object path, e.g. "tally-photos/{session_id}.jpg"
-- null when no photo has been uploaded
```

### Storage RLS policy

```sql
-- Service role bypasses RLS; anon/authenticated users cannot read tally-photos directly.
-- All access goes through the API route using the service role key.
create policy "no public read" on storage.objects
  for select using (bucket_id != 'tally-photos');
```

---

## API

### `POST /api/sessions/[id]/tally/extract`

Admin-only. Accepts a multipart form with a single image field (`photo`).

**Flow:**
1. Auth check — reject non-admins with 403
2. Confirm session is `completed` — reject with 400 otherwise
3. Upload image to Supabase Storage at path `{session_id}.{ext}` in bucket `tally-photos`
4. Update `sessions.tally_photo_path` with the storage path
5. Fetch the full active player list (`getActivePlayerList()`) to give the AI a roster
6. Generate a signed URL for the uploaded image (1-hour expiry) and pass it to the AI
7. Call Claude vision (`claude-3-5-sonnet-20241022`) with the image URL and roster
8. Parse the JSON response into `{ entries: [{ player_id, player_name, wins, losses }] }`
9. Return `{ entries, photo_path }` — entries may include `player_id: null` for unmatched names

**Request:** `multipart/form-data` with field `photo` (image/jpeg or image/png, max 10MB)

**Response 200:**
```json
{
  "entries": [
    { "player_id": "uuid", "player_name": "Kiran Iyer", "wins": 5, "losses": 2 },
    { "player_id": null,   "player_name": "Unknown Player", "wins": 3, "losses": 1 }
  ],
  "photo_path": "tally-photos/session-uuid.jpg"
}
```

**Response errors:**
- `403` — not admin
- `400` — session not completed, or no photo field
- `413` — file too large (> 10MB)
- `500` — storage upload failed or AI extraction failed

### AI prompt

```
You are extracting badminton scores from a whiteboard or score sheet photo.

Known players (match names on the board to these):
{JSON array of { id, name } for all active players}

Instructions:
- Find each player name on the board and their win (W) and loss (L) counts
- Match each board name to the closest player in the known list (fuzzy match: ignore case, handle abbreviations and first-name-only entries)
- If a name cannot be confidently matched to a known player, set player_id to null
- Do not invent players that are not visible on the board

Return ONLY valid JSON in this exact shape, no prose:
{
  "entries": [
    { "player_id": "<id or null>", "player_name": "<name as written on board>", "wins": <integer>, "losses": <integer> }
  ]
}
```

---

## UI

### Where the upload button appears

`TallyEntryForm` already has two states: initial entry (blank form) and edit (pre-filled). Add a third entry point: **photo upload**.

When the form is in initial-entry state (no existing tally data), show:

```
┌─────────────────────────────────────────────────┐
│  Enter Tally Scores (Admin)                      │
│                                                   │
│  [ 📷 Import from Photo ]  [ Enter Manually ]    │
│                                                   │
└─────────────────────────────────────────────────┘
```

When the form is in edit state (tally data already saved), show a smaller "Re-import from Photo" link at the bottom of the form (destructive, requires confirmation since it replaces current entries).

### Photo upload interaction

1. Admin taps **Import from Photo**
2. Native file picker opens (accept="image/*", capture="environment" for mobile camera)
3. A preview thumbnail of the selected image appears in the form
4. A spinner replaces the button with "Extracting scores…"
5. On success: form rows populate with extracted values
   - Matched entries: normal rows with player dropdown pre-selected
   - Unmatched entries (player_id null): row highlighted in amber, player dropdown blank, name shown as a hint in the dropdown placeholder — admin must pick the right player or delete the row
6. On failure: toast error "Could not extract scores — try again or enter manually"

### Unmatched player UX

```
┌──────────────────────────────────┬───┬───┐
│ ⚠ "Kiran" (not matched)  [▼ --] │ 5 │ 2 │  ← amber row, admin selects from dropdown
│ Kiran Iyer               [▼  ✓] │ 5 │ 2 │  ← after selecting, row goes normal
└──────────────────────────────────┴───┴───┘
```

### Admin: viewing the stored photo

After a tally entry form has been saved and a photo is on file, show a small "View source photo" link (admin only) below the TallyScoreboard that generates a signed URL and opens it in a new tab.

```
[Admin] Source photo →
```

---

## Files to create/modify

| File | Action |
|---|---|
| `src/app/api/sessions/[id]/tally/extract/route.ts` | Create — multipart upload + Supabase Storage + AI extraction |
| `src/components/TallyEntryForm.tsx` | Modify — add photo upload button, loading state, pre-fill from extraction response, unmatched row UX |
| `src/app/(app)/session/[id]/page.tsx` | Modify — pass `tally_photo_path` from session to TallyScoreboard for the "View source photo" link |
| `src/components/TallyScoreboard.tsx` | Modify — add admin-only "View source photo" link below table |
| `src/lib/db/sessions.ts` | Modify — `getSessionById` already returns session fields; confirm `tally_photo_path` is returned (or add to select) |
| Migration SQL | New column `sessions.tally_photo_path text` + storage bucket + RLS policy |

### Environment variables needed

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Server only | Claude vision API calls |
| (optional) `GOOGLE_GENERATIVE_AI_API_KEY` | Server only | Gemini fallback |

Add to `.env.local.example` and Vercel dashboard.

---

## Acceptance Criteria

- [ ] Admin sees "Import from Photo" button on the tally entry form for a completed session with no existing tally data
- [ ] Non-admins do not see the upload button at any point
- [ ] Tapping the button opens a file/camera picker on mobile
- [ ] After upload, a spinner shows "Extracting scores…" and the button is disabled
- [ ] Extracted entries pre-populate the tally form rows
- [ ] Entries with unmatched names are visually flagged (amber) and require admin to select a player before saving
- [ ] Saving is blocked until all unmatched rows are either resolved or deleted
- [ ] The uploaded photo is stored in Supabase Storage and linked to the session
- [ ] Admin can re-import from a new photo (with confirmation warning that existing entries will be replaced)
- [ ] Admin sees "View source photo" link below TallyScoreboard when a photo is on file; clicking opens a signed URL in a new tab
- [ ] Non-admins do not see the "View source photo" link
- [ ] If AI extraction fails, the form falls back to manual entry with a toast error
- [ ] Files larger than 10MB are rejected with a clear error before upload

---

## Open questions / decisions deferred

1. **AI model**: Default to Claude `claude-3-5-sonnet-20241022` (best handwriting + structured output). If `ANTHROPIC_API_KEY` is absent, fall back to Gemini `gemini-1.5-flash` using `GOOGLE_GENERATIVE_AI_API_KEY`. If neither is set, hide the upload button entirely.

2. **Re-import on edit**: When tally data already exists and admin re-imports, the extraction result replaces the current form entries (not the saved DB rows — those only change on explicit save). Show a confirmation: "This will replace your current entries with the extracted values. Continue?"

3. **Image format handling**: Accept JPEG and PNG. Reject other types with a clear error. No server-side resizing in v1 — if images are too large, Claude handles them natively up to its context limits.
