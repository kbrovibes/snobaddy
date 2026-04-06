import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { getActivePlayerList } from "@/lib/db/players";
import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

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
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Storage upload failed: " + uploadError.message }, { status: 500 });
  }

  // Save path on session
  await adminDb
    .from("sessions")
    .update({ tally_photo_path: storagePath })
    .eq("id", sessionId);

  // Fetch player roster for AI matching
  const allPlayers = await getActivePlayerList();
  const rosterJson = JSON.stringify(allPlayers.map((p) => ({ id: p.id, name: p.name })));

  // Call Gemini vision
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI extraction not configured (missing GOOGLE_GENERATIVE_AI_API_KEY)" }, { status: 503 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are extracting badminton scores from a whiteboard or score sheet photo.

Known players (match names on the board to these):
${rosterJson}

Instructions:
- Find each player name on the board and their win (W) and loss (L) counts
- Match each board name to the closest player in the known list (fuzzy match: ignore case, handle abbreviations and first-name-only entries)
- If a name cannot be confidently matched to a known player, set player_id to null
- Do not invent players not visible on the board
- Only include players that appear to have played (skip players with 0 wins and 0 losses if they have no entry on the board)

Return ONLY valid JSON, no prose, no markdown fences:
{"entries":[{"player_id":"<uuid or null>","player_name":"<name as on board>","wins":<integer>,"losses":<integer>}]}`;

  let extractedEntries: Array<{ player_id: string | null; player_name: string; wins: number; losses: number }> = [];

  try {
    const result = await model.generateContent([
      prompt,
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
    extractedEntries = parsed.entries ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "AI extraction failed: " + message }, { status: 500 });
  }

  return NextResponse.json({ entries: extractedEntries, photo_path: storagePath });
}
