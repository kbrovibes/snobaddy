import { supabase as adminDb } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

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
