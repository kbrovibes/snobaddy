import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

async function godModeGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: player } = await supabase
    .from("players").select("is_god_mode").eq("user_id", user.id).single();
  if (!player?.is_god_mode) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

// GET — pre-flight counts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await godModeGuard();
  if (error) return error;

  const { id } = await params;

  const [{ count: matches }, { count: proposed }, { count: tally }] = await Promise.all([
    serviceClient.from("matches").select("id", { count: "exact", head: true }).eq("session_id", id),
    serviceClient.from("proposed_matches").select("id", { count: "exact", head: true }).eq("session_id", id),
    serviceClient.from("session_tally").select("player_id", { count: "exact", head: true }).eq("session_id", id),
  ]);

  return NextResponse.json({ matches: matches ?? 0, proposed: proposed ?? 0, tally: tally ?? 0 });
}

// POST — backup then hard-delete all matches + proposed matches + tally for the session
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await godModeGuard();
  if (error) return error;

  const { id } = await params;

  // ── 1. Fetch session metadata ──────────────────────────────────────────────
  const { data: session } = await serviceClient
    .from("sessions")
    .select("id, date, is_test_session")
    .eq("id", id)
    .single();

  // ── 2. Fetch all data to back up ───────────────────────────────────────────
  const [
    { data: matchRows },
    { data: tallyRows },
    { data: proposedRows },
  ] = await Promise.all([
    serviceClient
      .from("matches")
      .select(`
        id, played_at, winning_team, team1_score, team2_score,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        t1p1:team1_player1_id(name),
        t1p2:team1_player2_id(name),
        t2p1:team2_player1_id(name),
        t2p2:team2_player2_id(name)
      `)
      .eq("session_id", id),
    serviceClient
      .from("session_tally")
      .select("player_id, wins, losses, players(name)")
      .eq("session_id", id),
    serviceClient
      .from("proposed_matches")
      .select(`
        id, deleted_at,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        t1p1:team1_player1_id(name),
        t1p2:team1_player2_id(name),
        t2p1:team2_player1_id(name),
        t2p2:team2_player2_id(name)
      `)
      .eq("session_id", id),
  ]);

  // ── 3. Build snapshot ──────────────────────────────────────────────────────
  const backedUpAt = new Date().toISOString();

  const matches = (matchRows ?? []).map((m) => ({
    id: m.id,
    played_at: m.played_at,
    winning_team: m.winning_team,
    team1_score: m.team1_score,
    team2_score: m.team2_score,
    team1_player1_id: m.team1_player1_id,
    team1_player2_id: m.team1_player2_id,
    team2_player1_id: m.team2_player1_id,
    team2_player2_id: m.team2_player2_id,
    team1_player1_name: (m.t1p1 as unknown as { name: string } | null)?.name ?? null,
    team1_player2_name: (m.t1p2 as unknown as { name: string } | null)?.name ?? null,
    team2_player1_name: (m.t2p1 as unknown as { name: string } | null)?.name ?? null,
    team2_player2_name: (m.t2p2 as unknown as { name: string } | null)?.name ?? null,
  }));

  const tally = (tallyRows ?? []).map((t) => ({
    player_id: t.player_id,
    player_name: (t.players as unknown as { name: string } | null)?.name ?? null,
    wins: t.wins,
    losses: t.losses,
  }));

  const proposed = (proposedRows ?? []).map((p) => ({
    id: p.id,
    deleted_at: p.deleted_at,
    team1_player1_id: p.team1_player1_id,
    team1_player2_id: p.team1_player2_id,
    team2_player1_id: p.team2_player1_id,
    team2_player2_id: p.team2_player2_id,
    team1_player1_name: (p.t1p1 as unknown as { name: string } | null)?.name ?? null,
    team1_player2_name: (p.t1p2 as unknown as { name: string } | null)?.name ?? null,
    team2_player1_name: (p.t2p1 as unknown as { name: string } | null)?.name ?? null,
    team2_player2_name: (p.t2p2 as unknown as { name: string } | null)?.name ?? null,
  }));

  const snapshot = {
    session_id: id,
    session_date: session?.date ?? null,
    is_test_session: session?.is_test_session ?? null,
    backed_up_at: backedUpAt,
    matches,
    tally,
    proposed_matches: proposed,
    summary: {
      match_count: matches.length,
      tally_count: tally.length,
      proposed_count: proposed.length,
    },
  };

  // ── 4. Persist backup — abort entire request if this fails ─────────────────
  const { error: backupError } = await serviceClient
    .from("session_reset_backups")
    .insert({ session_id: id, backed_up_at: backedUpAt, snapshot });

  if (backupError) {
    console.error("Reset backup failed — aborting reset:", backupError);
    return NextResponse.json(
      { error: "Backup failed — reset aborted to protect data", detail: backupError.message },
      { status: 500 }
    );
  }

  // ── 5. Now safe to delete + restore status ────────────────────────────────
  // Delete finals series and formats for this session
  await serviceClient.from("finals_series").delete().eq("session_id", id);
  await serviceClient.from("finals_formats").delete().eq("session_id", id);

  const [{ count: deletedMatches }, { count: deletedProposed }, { count: deletedTally }, { count: deletedCheckins }] = await Promise.all([
    serviceClient.from("matches").delete({ count: "exact" }).eq("session_id", id),
    serviceClient.from("proposed_matches").delete({ count: "exact" }).eq("session_id", id),
    serviceClient.from("session_tally").delete({ count: "exact" }).eq("session_id", id),
    serviceClient.from("session_players").delete({ count: "exact" }).eq("session_id", id),
    serviceClient.from("whiteboard_log").delete().eq("session_id", id),
  ]);

  // Restore session to pending (upcoming) state
  await serviceClient
    .from("sessions")
    .update({ status: "pending", started_at: null, started_by: null })
    .eq("id", id);

  return NextResponse.json({
    deleted_matches: deletedMatches ?? 0,
    deleted_proposed: deletedProposed ?? 0,
    deleted_tally: deletedTally ?? 0,
    deleted_checkins: deletedCheckins ?? 0,
  });
}
