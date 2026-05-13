import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { upsertSessionTally, logTallyCorrection } from "@/lib/db/tally";
import { getActivePlayerList } from "@/lib/db/players";
import { getAppSetting, setAppSetting } from "@/lib/db/settings";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("id, is_admin")
    .eq("user_id", user.id)
    .single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: sessionId } = await params;

  // Session must exist; fetch status, whiteboard_mode, and extraction snapshot
  const { data: session } = await adminDb
    .from("sessions")
    .select("status, tally_extraction_raw, whiteboard_mode")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Guard: reject if match records already exist (unless whiteboard mode)
  if (!session.whiteboard_mode) {
    const { count: matchCount } = await adminDb
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if ((matchCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot add tallies: matches already recorded for this session" },
        { status: 409 }
      );
    }
  }


  const body = await request.json();
  const { entries } = body as {
    entries: Array<{ player_id: string; wins: number; losses: number }>;
  };

  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "entries must be an array" }, { status: 400 });
  }

  for (const e of entries) {
    if (!e.player_id || typeof e.wins !== "number" || typeof e.losses !== "number") {
      return NextResponse.json(
        { error: "Each entry requires player_id, wins, and losses" },
        { status: 400 }
      );
    }
    if (e.wins < 0 || e.losses < 0) {
      return NextResponse.json(
        { error: "Wins and losses must be non-negative" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(e.wins) || !Number.isInteger(e.losses)) {
      return NextResponse.json(
        { error: "Wins and losses must be whole numbers" },
        { status: 400 }
      );
    }
  }

  // Snapshot existing tally before overwriting (null = first save)
  const { data: existingRows } = await adminDb
    .from("session_tally")
    .select("player_id, wins, losses")
    .eq("session_id", sessionId);
  const previousTally = existingRows && existingRows.length > 0 ? existingRows : null;

  try {
    await upsertSessionTally(sessionId, entries);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Log whenever a photo extraction exists — captures both first saves and edits
  if (session.tally_extraction_raw) {
    await logTallyCorrection({
      sessionId,
      savedBy: player.id,
      aiExtraction: session.tally_extraction_raw,
      previousTally,
      savedTally: entries,
    });

    // Learn name aliases from user corrections.
    // Compare AI-extracted raw names against the player IDs the user actually saved.
    try {
      const allPlayers = await getActivePlayerList();
      const playerMap = new Map(allPlayers.map((p) => [p.id, p.name]));
      const rawEntries = session.tally_extraction_raw as Array<{ name: string; wins: number; losses: number }>;

      // Load existing aliases
      const aliasJson = await getAppSetting("tally_name_aliases");
      const aliases: Record<string, string> = aliasJson ? JSON.parse(aliasJson) : {};
      let changed = false;

      // For each saved entry, find the corresponding raw extraction entry by position
      // (extraction and save maintain same order for matched entries)
      for (const saved of entries) {
        const playerName = playerMap.get(saved.player_id);
        if (!playerName) continue;

        // Find raw entries that match this player's wins/losses but have a different name
        for (const raw of rawEntries) {
          if (raw.wins === saved.wins && raw.losses === saved.losses) {
            const rawNorm = raw.name.trim().toLowerCase();
            const playerNorm = playerName.toLowerCase();
            // Only learn if the raw name differs from the player name and isn't already known
            if (rawNorm !== playerNorm && !aliases[rawNorm]) {
              aliases[rawNorm] = playerName;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        await setAppSetting("tally_name_aliases", JSON.stringify(aliases));
      }
    } catch {
      // Non-critical — don't fail the save if alias learning errors
    }
  }

  return NextResponse.json({ ok: true });
}
