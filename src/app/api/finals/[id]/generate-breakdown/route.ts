import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { getActivePlayers } from "@/lib/db/players";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(currentPlayer as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Only allowed in draft or breakdown_generated (idempotent re-run)
  const { data: event } = await supabase
    .from("finals_events")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "draft" && event.status !== "breakdown_generated") {
    return NextResponse.json(
      { error: "Breakdown can only be generated while in draft or re-run before confirming" },
      { status: 409 }
    );
  }

  // Load all participants for this event
  const { data: participantRows } = await supabase
    .from("finals_participants")
    .select("id, player_id, group_override, group_label")
    .eq("finals_event_id", id);

  if (!participantRows || participantRows.length < 4) {
    return NextResponse.json(
      { error: "Add at least 4 players before generating the breakdown" },
      { status: 400 }
    );
  }

  // Load season stats for all active players
  const allPlayers = await getActivePlayers();
  const statsById = new Map(allPlayers.map((p) => [p.id, p]));

  // Compute Finals Score for each participant
  const scored = participantRows.map((row) => {
    const stats = statsById.get(row.player_id);
    const skillLevel = stats?.skill_level ?? 3;
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const total = wins + losses;

    // Win rate: 0–100. Default 50 if no data.
    const winRate = total > 0 ? (wins / total) * 100 : 50;

    // Skill score: maps skill 1→0, 5→100
    const skillScore = ((skillLevel - 1) / 4) * 100;

    // Finals Score = Skill (50%) + Win Rate (50%)
    const finalsScore = skillScore * 0.5 + winRate * 0.5;

    const seasonWinRate = Math.round(winRate * 100) / 100;

    const scoreBreakdown = {
      skill: Math.round(skillScore * 0.5 * 100) / 100,
      win_rate: Math.round(winRate * 0.5 * 100) / 100,
    };

    let explanation: string;
    if (total === 0) {
      explanation = `Skill ${skillLevel} player with no season data — win rate defaulted to 50%.`;
    } else {
      const wrLabel = winRate >= 60 ? "strong" : winRate >= 45 ? "solid" : "developing";
      const skillLabel =
        skillLevel >= 4 ? "advanced" : skillLevel >= 3 ? "intermediate" : "beginner";
      explanation = `${skillLabel.charAt(0).toUpperCase() + skillLabel.slice(1)} player (Skill ${skillLevel}) with a ${wrLabel} season win rate of ${Math.round(winRate)}% (${wins}W–${losses}L).`;
    }

    return {
      id: row.id,
      player_id: row.player_id,
      skill_level: skillLevel,
      season_win_rate: seasonWinRate,
      season_wins: wins,
      season_losses: losses,
      finals_score: Math.round(finalsScore * 100) / 100,
      score_breakdown: scoreBreakdown,
      score_explanation: explanation,
      group_override: row.group_override ?? false,
      existing_group: row.group_label as string | null,
    };
  });

  // Sort by finals_score descending
  scored.sort((a, b) => b.finals_score - a.finals_score);

  const total = scored.length;

  // Auto-assign groups: even sizes (divisible by 2), prioritize A & B larger.
  // Strategy: split into 3 groups as evenly as possible, all even.
  // When there's a remainder, add to A first, then B.
  function computeGroupSizes(n: number): [number, number, number] {
    // Base: each group gets floor(n/3), rounded down to even
    const base = Math.floor(n / 3);
    const baseEven = base - (base % 2); // round down to even
    let a = Math.max(4, baseEven);
    let b = Math.max(4, baseEven);
    let c = Math.max(4, baseEven);

    // Distribute leftover players 2 at a time, prioritizing A then B
    let leftover = n - a - b - c;
    while (leftover >= 2) {
      if (a <= b) { a += 2; }
      else { b += 2; }
      leftover -= 2;
    }

    // If 1 leftover (odd total), one group must be odd — put it in C (lowest priority)
    if (leftover === 1) { c += 1; }

    // Ensure A >= B (A is the top group)
    if (b > a) { const tmp = a; a = b; b = tmp; }

    return [a, b, c];
  }

  const [aCount, bCount] = computeGroupSizes(total);

  const updates = scored.map((p, idx) => {
    // Preserve manual overrides
    const group = p.group_override && p.existing_group
      ? p.existing_group
      : idx < aCount
      ? "A"
      : idx < aCount + bCount
      ? "B"
      : "C";

    return {
      id: p.id,
      skill_level: p.skill_level,
      season_win_rate: p.season_win_rate,
      season_wins: p.season_wins,
      season_losses: p.season_losses,
      finals_score: p.finals_score,
      score_breakdown: p.score_breakdown,
      score_explanation: p.score_explanation,
      group_label: group,
      finals_day: group === "C" ? 2 : 1,
    };
  });

  // Upsert all participant rows with computed data
  for (const u of updates) {
    await adminDb
      .from("finals_participants")
      .update({
        skill_level: u.skill_level,
        season_win_rate: u.season_win_rate,
        season_wins: u.season_wins,
        season_losses: u.season_losses,
        finals_score: u.finals_score,
        score_breakdown: u.score_breakdown,
        score_explanation: u.score_explanation,
        group_label: u.group_label,
        finals_day: u.finals_day,
      })
      .eq("id", u.id);
  }

  // Transition to breakdown_generated if still in draft
  if (event.status === "draft") {
    await adminDb
      .from("finals_events")
      .update({ status: "breakdown_generated" })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true, scored: updates.length });
}
