import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

interface SavedPair {
  player1_id: string;
  player2_id: string;
}

/**
 * Generate round-robin matches for Fixed-Partner format.
 * Every pair plays every other pair exactly once per group.
 * Distributes matches so no pair plays consecutive matches where avoidable.
 */
function generateRoundRobin(pairs: SavedPair[], groupLabel: string, sessionId: string) {
  const n = pairs.length;
  if (n < 2) return [];

  // Generate all pair combinations
  const matchups: { pair1: number; pair2: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      matchups.push({ pair1: i, pair2: j });
    }
  }

  // Distribute so no pair plays consecutive matches where avoidable.
  // Simple greedy: sort matchups so that consecutive entries share minimal pairs.
  const ordered: typeof matchups = [];
  const remaining = [...matchups];
  // Start with first matchup
  ordered.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    const lastPairs = new Set([last.pair1, last.pair2]);

    // Find a matchup that doesn't share a pair with the last one
    let bestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const m = remaining[i];
      if (!lastPairs.has(m.pair1) && !lastPairs.has(m.pair2)) {
        bestIdx = i;
        break;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  // Convert to match insert rows
  return ordered.map((m) => ({
    session_id: sessionId,
    team1_player1_id: pairs[m.pair1].player1_id,
    team1_player2_id: pairs[m.pair1].player2_id,
    team2_player1_id: pairs[m.pair2].player1_id,
    team2_player2_id: pairs[m.pair2].player2_id,
    team1_score: 0,
    team2_score: 0,
    winning_team: null,
    match_type: "finals_group",
    finals_group: groupLabel,
  }));
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;

  // Verify format exists and is ready
  const { data: format } = await supabase
    .from("finals_formats")
    .select("id, format_type, status, config")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!format) {
    return NextResponse.json({ error: "No format selected" }, { status: 400 });
  }
  if (format.format_type !== "fixed_partner") {
    return NextResponse.json({ error: "This endpoint is for Fixed-Partner format only" }, { status: 400 });
  }
  if (format.status !== "configured") {
    return NextResponse.json(
      { error: "Matches have already been generated" },
      { status: 409 }
    );
  }

  const config = format.config as { pairs?: Record<string, SavedPair[]> };
  if (!config?.pairs || Object.keys(config.pairs).length === 0) {
    return NextResponse.json({ error: "Save pairs before generating matches" }, { status: 400 });
  }

  // Generate round-robin matches for each group
  const allMatches: ReturnType<typeof generateRoundRobin> = [];
  for (const [groupLabel, pairs] of Object.entries(config.pairs)) {
    if (pairs.length < 2) {
      return NextResponse.json(
        { error: `Group ${groupLabel} needs at least 2 pairs` },
        { status: 400 }
      );
    }
    allMatches.push(...generateRoundRobin(pairs, groupLabel, sessionId));
  }

  if (allMatches.length === 0) {
    return NextResponse.json({ error: "No matches to generate" }, { status: 400 });
  }

  // Insert all matches in one batch
  const { error: insertErr } = await adminDb
    .from("matches")
    .insert(allMatches);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Update format status
  const { error: updateErr } = await adminDb
    .from("finals_formats")
    .update({ status: "matches_generated" })
    .eq("id", format.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    matchCount: allMatches.length,
    groups: Object.keys(config.pairs),
  });
}
