import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { getActivePlayerList } from "@/lib/db/players";
import { getAppSetting, setAppSetting } from "@/lib/db/settings";
import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Known first-name disambiguations for this club.
// When a raw name matches multiple players by first name, these take precedence.
const FIRST_NAME_DEFAULTS: Record<string, string> = {
  kiran: "Kiran Iyer",
  swathi: "Swathi Rajan",
  teja: "Ravi Teja Boppana",
};

/**
 * Load persisted name aliases from app_settings.
 * Returns a map of lowercase raw name → player full name.
 */
async function loadNameAliases(): Promise<Record<string, string>> {
  const raw = await getAppSetting("tally_name_aliases");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save updated name aliases to app_settings.
 */
async function saveNameAliases(aliases: Record<string, string>): Promise<void> {
  await setAppSetting("tally_name_aliases", JSON.stringify(aliases));
}

/**
 * Match a raw name from the board to a player in the roster.
 * Returns the player id if matched, null if unmatched/ambiguous.
 */
function matchName(
  rawName: string,
  roster: Array<{ id: string; name: string }>,
  aliases: Record<string, string>
): string | null {
  const norm = rawName.trim().toLowerCase();

  // 1. Exact full-name match (case-insensitive)
  const exact = roster.find((p) => p.name.toLowerCase() === norm);
  if (exact) return exact.id;

  // 2. Check persisted aliases (learned from past corrections)
  const aliasFullName = aliases[norm];
  if (aliasFullName) {
    const aliasMatch = roster.find(
      (p) => p.name.toLowerCase() === aliasFullName.toLowerCase()
    );
    if (aliasMatch) return aliasMatch.id;
  }

  // 3. Check known first-name defaults
  const defaultFullName = FIRST_NAME_DEFAULTS[norm];
  if (defaultFullName) {
    const defaultMatch = roster.find(
      (p) => p.name.toLowerCase() === defaultFullName.toLowerCase()
    );
    if (defaultMatch) return defaultMatch.id;
  }

  // 4. First-name-only match — only resolve if unambiguous
  const firstNameMatches = roster.filter(
    (p) => p.name.split(" ")[0].toLowerCase() === norm
  );
  if (firstNameMatches.length === 1) return firstNameMatches[0].id;

  // 5. Partial match: raw name is a substring of a player's full name (e.g. "SaiDurga" → "Sai Durga")
  const partialMatches = roster.filter((p) =>
    p.name.toLowerCase().replace(/\s+/g, "").includes(norm.replace(/\s+/g, ""))
  );
  if (partialMatches.length === 1) return partialMatches[0].id;

  return null;
}

const EXTRACTION_PROMPT = `You are a precise data extraction assistant. Your job is to read a badminton session
scoreboard photo and extract each player's win and loss counts from tally marks.

## How tally marks work
- Each WIN or LOSS is recorded as a vertical stroke: |
- Every 5th stroke is drawn diagonally across the previous 4, like: ||||
  This makes groups of 5 easy to count.
- Strokes are made quickly by hand, so they may be:
  - Slightly slanted or leaning (do NOT interpret a leaning stroke as a letter like V, I, or L)
  - Touching or overlapping adjacent strokes (do NOT merge two strokes into one)
  - Unevenly spaced (do NOT interpret a gap as a separator between groups)
- The diagonal cross-stroke is the 5TH stroke in a group — do NOT count it as an
  extra stroke on top of 4. A complete crossed group = exactly 5.

## Counting method
For each cell, count as follows:
1. Count how many complete crossed groups (||||) are present → multiply by 5
2. Count any remaining upright strokes after the last complete group → add them
3. If the cell is empty or blank → count is 0

## Board layout
- The board has player names in a column on the left
- There are two sections: LEFT half and RIGHT half, each with a W (wins) column and
  an L (losses) column
- The header row shows: W | L | [name column] | W | L
- Read BOTH the left section and right section — they are part of the same board
- Extract the date if visible (usually written at the top, e.g. "03/30")

## Output format
Return ONLY a JSON object. No explanation, no markdown, no preamble. Example:

{
  "date": "03/30",
  "players": [
    { "name": "Alice", "wins": 5, "losses": 3 },
    { "name": "Bob", "wins": 0, "losses": 2 }
  ]
}

Rules:
- "date" should be the session date as written on the board. If not visible, use null.
- "name" should be the player name exactly as written (preserve capitalization).
- "wins" and "losses" must be integers.
- Include ALL players visible on the board, even those with 0 wins and 0 losses.
- Do NOT skip players just because their cells look empty — record them with 0s.
- Do NOT invent players not visible on the board.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  // Auth: admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Session must be completed
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Parse multipart form
  const formData = await request.formData();
  const file = formData.get("photo") as File | null;
  if (!file) return NextResponse.json({ error: "No photo provided" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo exceeds 10MB limit" }, { status: 413 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WEBP, or HEIC images are accepted" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${sessionId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage (upsert — re-upload replaces previous)
  const { error: uploadError } = await adminDb.storage
    .from("tally-photos")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "Storage upload failed: " + uploadError.message }, { status: 500 });
  }

  // Save path on session
  await adminDb
    .from("sessions")
    .update({ tally_photo_path: storagePath })
    .eq("id", sessionId);

  // Read model choice from DB (falls back to haiku if not set)
  const modelId = (await getAppSetting("tally_extraction_model")) ?? "claude-haiku-4-5-20251001";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI extraction not configured (missing ANTHROPIC_API_KEY)" },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  let rawPlayers: Array<{ name: string; wins: number; losses: number }> = [];
  let extractedDate: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as "image/jpeg" | "image/png" | "image/webp",
                data: buffer.toString("base64"),
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    // Find the text block — Sonnet 4.6 may prepend a thinking block so content[0] is not always text
    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    if (!textBlock) throw new Error("No text block in model response");
    // Extract the outermost JSON object — handles any preamble/postamble the model adds
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in model response");
    const cleaned = jsonMatch[0];
    const parsed = JSON.parse(cleaned);
    rawPlayers = parsed.players ?? [];
    extractedDate = parsed.date ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "AI extraction failed: " + message }, { status: 500 });
  }

  // Persist raw AI output so we can later diff against what was actually saved
  await adminDb
    .from("sessions")
    .update({ tally_extraction_raw: rawPlayers })
    .eq("id", sessionId);

  // Server-side name matching against the roster
  const [allPlayers, aliases] = await Promise.all([
    getActivePlayerList(),
    loadNameAliases(),
  ]);

  const entries = rawPlayers.map((raw) => {
    const matchedId = matchName(raw.name, allPlayers, aliases);
    const matchedPlayer = matchedId ? allPlayers.find((p) => p.id === matchedId) : null;
    const rawNorm = raw.name.trim().toLowerCase();
    const correctedFromAlias = !!(matchedId && aliases[rawNorm]);
    return {
      player_id: matchedId,
      // Use DB name if matched, raw name if not (shown to user for resolution)
      player_name: matchedPlayer?.name ?? raw.name,
      raw_name: raw.name,
      wins: raw.wins,
      losses: raw.losses,
      unmatched: matchedId === null,
      corrected_from_alias: correctedFromAlias,
    };
  });

  // Sanity check: wins should equal losses in a balanced session
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const totalLosses = entries.reduce((s, e) => s + e.losses, 0);
  const balanced = totalWins === totalLosses;

  return NextResponse.json({
    entries,
    photo_path: storagePath,
    extracted_date: extractedDate,
    validation: {
      balanced,
      total_wins: totalWins,
      total_losses: totalLosses,
    },
  });
}
