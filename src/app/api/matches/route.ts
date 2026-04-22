import { createClient } from "@/lib/supabase-server";
import { backfillMatchQueue } from "@/lib/db/proposed";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { session_id, team1, team2, team1_score, team2_score } = body;

  // Validate all 4 players are unique
  const ids: string[] = [team1[0], team1[1], team2[0], team2[1]];
  if (new Set(ids).size !== 4) {
    return NextResponse.json({ error: "All 4 players must be different" }, { status: 400 });
  }

  // Validate scores
  if (team1_score === team2_score) {
    return NextResponse.json({ error: "Scores cannot be tied" }, { status: 400 });
  }

  // Guard: reject if tally data already exists for this session (unless whiteboard mode)
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("whiteboard_mode")
    .eq("id", session_id)
    .maybeSingle();
  if (!sessionRow?.whiteboard_mode) {
    const { count: tallyCount } = await supabase
      .from("session_tally")
      .select("*", { count: "exact", head: true })
      .eq("session_id", session_id);
    if ((tallyCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot record matches: tally data already exists for this session" },
        { status: 409 }
      );
    }
  }

  // Validate all players are checked in to this session
  const { data: checkedIn } = await supabase
    .from("session_players")
    .select("player_id")
    .eq("session_id", session_id)
    .is("checked_out_at", null)
    .in("player_id", ids);

  if ((checkedIn?.length ?? 0) < 4) {
    return NextResponse.json({ error: "All players must be checked in" }, { status: 400 });
  }

  const winning_team = team1_score > team2_score ? 1 : 2;

  const { error } = await supabase.from("matches").insert({
    session_id,
    team1_player1_id: team1[0],
    team1_player2_id: team1[1],
    team2_player1_id: team2[0],
    team2_player2_id: team2[1],
    team1_score,
    team2_score,
    winning_team,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await backfillMatchQueue(session_id);
  return NextResponse.json({ ok: true });
}
