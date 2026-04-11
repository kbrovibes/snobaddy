import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — create a Best-of-3 series from top 4 players
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = await req.json();
  const { finals_group, format_id, top4 } = body as {
    finals_group: string;
    format_id: string;
    top4: string[]; // [seed1, seed2, seed3, seed4]
  };

  if (!finals_group || !["A", "B", "C"].includes(finals_group)) {
    return NextResponse.json({ error: "finals_group must be A or B" }, { status: 400 });
  }
  if (!top4 || top4.length !== 4) {
    return NextResponse.json({ error: "Exactly 4 player IDs required" }, { status: 400 });
  }

  // Verify format status
  const { data: format } = await supabase
    .from("finals_formats")
    .select("id, status")
    .eq("id", format_id)
    .maybeSingle();

  if (!format) return NextResponse.json({ error: "Format not found" }, { status: 404 });
  if (format.status !== "matches_generated") {
    return NextResponse.json({ error: "Group matches must be complete first" }, { status: 409 });
  }

  // Check no series exists already
  const { data: existingSeries } = await supabase
    .from("finals_series")
    .select("id")
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group)
    .maybeSingle();

  if (existingSeries) {
    return NextResponse.json({ error: "Series already exists for this group" }, { status: 409 });
  }

  // Seeding: Team 1 = Seed #1 + Seed #4, Team 2 = Seed #2 + Seed #3
  const [seed1, seed2, seed3, seed4] = top4;

  const { data: series, error: seriesErr } = await adminDb
    .from("finals_series")
    .insert({
      session_id: sessionId,
      finals_group,
      format_id,
      team1_player1_id: seed1,
      team1_player2_id: seed4,
      team1_seed: "#1 + #4",
      team2_player1_id: seed2,
      team2_player2_id: seed3,
      team2_seed: "#2 + #3",
      status: "active",
    })
    .select("id")
    .single();

  if (seriesErr) return NextResponse.json({ error: seriesErr.message }, { status: 500 });

  // Create 3 match shells for the series (game 3 may not be played)
  const seriesMatches = [1, 2, 3].map(() => ({
    session_id: sessionId,
    team1_player1_id: seed1,
    team1_player2_id: seed4,
    team2_player1_id: seed2,
    team2_player2_id: seed3,
    match_type: "finals_final",
    finals_group,
    series_id: series.id,
  }));

  const { error: matchErr } = await adminDb.from("matches").insert(seriesMatches);
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  // Update format status
  await adminDb
    .from("finals_formats")
    .update({ status: "playoffs_complete" })
    .eq("id", format_id);

  return NextResponse.json({ ok: true, seriesId: series.id });
}

// PATCH — record a series game result and check for series winner
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = await req.json();
  const { match_id, team1_score, team2_score } = body as {
    match_id: string;
    team1_score: number;
    team2_score: number;
  };

  if (typeof team1_score !== "number" || typeof team2_score !== "number" || team1_score < 0 || team2_score < 0) {
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
  }
  if (team1_score === team2_score) {
    return NextResponse.json({ error: "Scores cannot be tied" }, { status: 400 });
  }

  const winning_team = team1_score > team2_score ? 1 : 2;

  // Update the match
  const { error: updateErr } = await adminDb
    .from("matches")
    .update({ team1_score, team2_score, winning_team })
    .eq("id", match_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Get the match to find series_id
  const { data: match } = await supabase
    .from("matches")
    .select("series_id")
    .eq("id", match_id)
    .single();

  if (!match?.series_id) return NextResponse.json({ ok: true });

  // Count series wins
  const { data: seriesMatches } = await supabase
    .from("matches")
    .select("winning_team")
    .eq("series_id", match.series_id)
    .not("winning_team", "is", null);

  let t1wins = 0;
  let t2wins = 0;
  for (const m of seriesMatches ?? []) {
    if ((m as { winning_team: number }).winning_team === 1) t1wins++;
    else t2wins++;
  }

  // Update series wins
  const seriesUpdate: Record<string, unknown> = { team1_wins: t1wins, team2_wins: t2wins };
  if (t1wins >= 2 || t2wins >= 2) {
    seriesUpdate.winning_team = t1wins >= 2 ? 1 : 2;
    seriesUpdate.status = "completed";

    // Also mark format as completed
    const { data: series } = await supabase
      .from("finals_series")
      .select("format_id")
      .eq("id", match.series_id)
      .single();
    if (series) {
      await adminDb
        .from("finals_formats")
        .update({ status: "completed" })
        .eq("id", (series as { format_id: string }).format_id);
    }
  }

  await adminDb
    .from("finals_series")
    .update(seriesUpdate)
    .eq("id", match.series_id);

  return NextResponse.json({ ok: true, team1_wins: t1wins, team2_wins: t2wins });
}
