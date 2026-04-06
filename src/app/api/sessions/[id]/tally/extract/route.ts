import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { getActivePlayerList } from "@/lib/db/players";
import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Known first-name disambiguations for this club.
// When a raw name matches multiple players by first name, these take precedence.
const FIRST_NAME_DEFAULTS: Record<string, string> = {
  kiran: "Kiran Iyer",
  swathi: "Swathi Rajan",
  teja: "Ravi Teja Boppana",
};

/**
 * Match a raw name from the board to a player in the roster.
 * Returns the player id if matched, null if unmatched/ambiguous.
 */
function matchName(
  rawName: string,
  roster: Array<{ id: string; name: string }>
): string | null {
  const norm = rawName.trim().toLowerCase();

  // 1. Exact full-name match (case-insensitive)
  const exact = roster.find((p) => p.name.toLowerCase() === norm);
  if (exact) return exact.id;

  // 2. Check known first-name defaults
  const defaultFullName = FIRST_NAME_DEFAULTS[norm];
  if (defaultFullName) {
    const defaultMatch = roster.find(
      (p) => p.name.toLowerCase() === defaultFullName.toLowerCase()
    );
    if (defaultMatch) return defaultMatch.id;
  }

  // 3. First-name-only match — only resolve if unambiguous
  const firstNameMatches = roster.filter(
    (p) => p.name.split(" ")[0].toLowerCase() === norm
  );
  if (firstNameMatches.length === 1) return firstNameMatches[0].id;

  // 4. Partial match: raw name is a substring of a player's full name (e.g. "SaiDurga" → "Sai Durga")
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

  // Auth: god mode only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Session must be completed
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "completed") {
    return NextResponse.json({ error: "Session is not completed" }, { status: 400 });
  }

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

  // Call Gemini vision
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI extraction not configured (missing GOOGLE_GENERATIVE_AI_API_KEY)" },
      { status: 503 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let rawPlayers: Array<{ name: string; wins: number; losses: number }> = [];
  let extractedDate: string | null = null;

  try {
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          data: buffer.toString("base64"),
        },
      },
    ]);

    const text = result.response.text().trim();
    // Strip markdown fences if model adds them despite instructions
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    rawPlayers = parsed.players ?? [];
    extractedDate = parsed.date ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "AI extraction failed: " + message }, { status: 500 });
  }

  // Server-side name matching against the roster
  const allPlayers = await getActivePlayerList();

  const entries = rawPlayers.map((raw) => {
    const matchedId = matchName(raw.name, allPlayers);
    const matchedPlayer = matchedId ? allPlayers.find((p) => p.id === matchedId) : null;
    return {
      player_id: matchedId,
      // Use DB name if matched, raw name if not (shown to user for resolution)
      player_name: matchedPlayer?.name ?? raw.name,
      raw_name: raw.name,
      wins: raw.wins,
      losses: raw.losses,
      unmatched: matchedId === null,
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
