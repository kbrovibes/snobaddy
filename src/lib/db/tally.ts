import { supabase as adminDb } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export interface WhiteboardPlayer {
  player_id: string;
  name: string;
  wins: number;
  losses: number;
  checked_out: boolean;
}

export interface TallyEntry {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
}

export async function getSessionTally(sessionId: string): Promise<TallyEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_tally")
    .select("player_id, wins, losses, players(name)")
    .eq("session_id", sessionId)
    .order("wins", { ascending: false });

  return (data ?? []).map((r) => ({
    player_id: r.player_id,
    player_name: (r.players as unknown as { name: string }).name,
    wins: r.wins,
    losses: r.losses,
  }));
}

export async function logTallyCorrection(opts: {
  sessionId: string;
  savedBy: string;
  aiExtraction: unknown;
  previousTally: unknown;
  savedTally: unknown;
}): Promise<void> {
  await adminDb.from("tally_correction_log").insert({
    session_id: opts.sessionId,
    saved_by: opts.savedBy,
    ai_extraction: opts.aiExtraction,
    previous_tally: opts.previousTally,
    saved_tally: opts.savedTally,
  });
}

/**
 * Full replacement: deletes all existing tally rows for the session,
 * then inserts the new batch. Idempotent — safe to call on re-save.
 */
export async function upsertSessionTally(
  sessionId: string,
  entries: Array<{ player_id: string; wins: number; losses: number }>
): Promise<void> {
  const { error: delErr } = await adminDb
    .from("session_tally")
    .delete()
    .eq("session_id", sessionId);
  if (delErr) throw new Error(delErr.message);

  if (entries.length === 0) return;

  const { error } = await adminDb
    .from("session_tally")
    .insert(entries.map((e) => ({ ...e, session_id: sessionId })));
  if (error) throw new Error(error.message);
}

/**
 * Returns all session players (checked-in and checked-out) with their tally data.
 * Used by WhiteboardTally component during active sessions.
 */
export async function getWhiteboardPlayers(sessionId: string): Promise<WhiteboardPlayer[]> {
  const supabase = await createClient();

  // Get all session participants (including checked-out), filter deleted in JS
  const { data: allSp } = await supabase
    .from("session_players")
    .select("player_id, checked_out_at, players(name, deleted_at)")
    .eq("session_id", sessionId);

  const activePlayers = (allSp ?? []).filter(
    (sp) => !(sp.players as unknown as { deleted_at: string | null }).deleted_at
  );

  // Get tally data for this session
  const { data: tallyRows } = await supabase
    .from("session_tally")
    .select("player_id, wins, losses")
    .eq("session_id", sessionId);

  const tallyMap = new Map(
    (tallyRows ?? []).map((t) => [t.player_id, { wins: t.wins, losses: t.losses }])
  );

  return activePlayers.map((sp) => ({
    player_id: sp.player_id,
    name: (sp.players as unknown as { name: string }).name,
    wins: tallyMap.get(sp.player_id)?.wins ?? 0,
    losses: tallyMap.get(sp.player_id)?.losses ?? 0,
    checked_out: sp.checked_out_at !== null,
  }));
}

/**
 * Increment or decrement a single player's wins or losses by 1.
 * Creates the tally row if it doesn't exist. Clamps to 0 minimum.
 */
export async function incrementTally(
  sessionId: string,
  playerId: string,
  field: "wins" | "losses",
  delta: 1 | -1
): Promise<{ wins: number; losses: number }> {
  // Fetch existing row
  const { data: existing } = await adminDb
    .from("session_tally")
    .select("wins, losses")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existing) {
    const newVal = Math.max(0, existing[field] + delta);
    const updated = { ...existing, [field]: newVal };
    await adminDb
      .from("session_tally")
      .update({ [field]: newVal })
      .eq("session_id", sessionId)
      .eq("player_id", playerId);
    return { wins: updated.wins, losses: updated.losses };
  }

  // No row yet — insert (only if positive delta)
  const newRow = { wins: 0, losses: 0, [field]: delta > 0 ? 1 : 0 };
  await adminDb
    .from("session_tally")
    .insert({ session_id: sessionId, player_id: playerId, ...newRow });
  return newRow;
}
