import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

interface SavedPair {
  player1_id: string;
  player2_id: string;
}

// ── Fixed-Partner: round-robin (every pair vs every other pair once) ─────────
function generateFixedPartnerMatches(pairs: SavedPair[], groupLabel: string, sessionId: string) {
  const n = pairs.length;
  if (n < 2) return [];

  const matchups: { pair1: number; pair2: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      matchups.push({ pair1: i, pair2: j });
    }
  }

  // Greedy: avoid consecutive play for the same pair
  const ordered: typeof matchups = [];
  const remaining = [...matchups];
  ordered.push(remaining.shift()!);
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    const lastPairs = new Set([last.pair1, last.pair2]);
    let bestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      if (!lastPairs.has(remaining[i].pair1) && !lastPairs.has(remaining[i].pair2)) {
        bestIdx = i;
        break;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  return ordered.map((m) => ({
    session_id: sessionId,
    team1_player1_id: pairs[m.pair1].player1_id,
    team1_player2_id: pairs[m.pair1].player2_id,
    team2_player1_id: pairs[m.pair2].player1_id,
    team2_player2_id: pairs[m.pair2].player2_id,
    match_type: "finals_group",
    finals_group: groupLabel,
  }));
}

// ── Playoffs: rotating partners, ~4 matches per player ──────────────────────
function generatePlayoffsMatches(playerIds: string[], groupLabel: string, sessionId: string) {
  const n = playerIds.length;
  if (n < 4) return [];

  // Target: ~4 matches per player → total matches = n * 4 / 4 = n
  const targetMatches = n;

  // Track partner/opponent history
  const partnerCount = new Map<string, Map<string, number>>(); // player → partner → count
  const matchCount = new Map<string, number>(); // player → total matches
  for (const id of playerIds) {
    partnerCount.set(id, new Map());
    matchCount.set(id, 0);
  }

  const matches: {
    session_id: string;
    team1_player1_id: string;
    team1_player2_id: string;
    team2_player1_id: string;
    team2_player2_id: string;
    match_type: string;
    finals_group: string;
  }[] = [];

  // Generate all valid 4-player combos, score them, pick the best greedily
  for (let round = 0; round < targetMatches; round++) {
    let bestMatch: [string, string, string, string] | null = null;
    let bestScore = -Infinity;

    // Try random samples to find good matches (full enumeration too expensive for large N)
    const attempts = Math.min(n * n * 2, 200);
    for (let attempt = 0; attempt < attempts; attempt++) {
      // Pick 4 players, prioritizing those with fewer matches
      const sorted = [...playerIds].sort(
        (a, b) => (matchCount.get(a) ?? 0) - (matchCount.get(b) ?? 0)
      );

      let candidates: string[];
      if (attempt < n) {
        // First N attempts: structured — take lowest-match players
        candidates = sorted.slice(0, Math.min(6, n));
      } else {
        // Random sampling from full pool
        candidates = [...playerIds];
      }

      // Pick 4 from candidates
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      if (shuffled.length < 4) continue;
      const four = shuffled.slice(0, 4);

      // Try both team arrangements: (0,1 vs 2,3) and (0,2 vs 1,3)
      const arrangements: [string, string, string, string][] = [
        [four[0], four[1], four[2], four[3]],
        [four[0], four[2], four[1], four[3]],
      ];

      for (const arr of arrangements) {
        let score = 0;

        // Prefer players with fewer matches (fairness)
        for (const id of arr) {
          score += Math.max(0, 4 - (matchCount.get(id) ?? 0)) * 10;
        }

        // Penalize repeat partnerships
        const pc = partnerCount;
        score -= (pc.get(arr[0])?.get(arr[1]) ?? 0) * 20;
        score -= (pc.get(arr[2])?.get(arr[3]) ?? 0) * 20;

        // Penalize if any player has 5+ matches already
        for (const id of arr) {
          if ((matchCount.get(id) ?? 0) >= 5) score -= 50;
        }

        // Small random tiebreaker
        score += Math.random() * 2;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = arr;
        }
      }
    }

    if (!bestMatch) break;

    const [p1, p2, p3, p4] = bestMatch;
    matches.push({
      session_id: sessionId,
      team1_player1_id: p1,
      team1_player2_id: p2,
      team2_player1_id: p3,
      team2_player2_id: p4,
      match_type: "finals_group",
      finals_group: groupLabel,
    });

    // Update tracking
    for (const id of bestMatch) matchCount.set(id, (matchCount.get(id) ?? 0) + 1);
    partnerCount.get(p1)!.set(p2, (partnerCount.get(p1)!.get(p2) ?? 0) + 1);
    partnerCount.get(p2)!.set(p1, (partnerCount.get(p2)!.get(p1) ?? 0) + 1);
    partnerCount.get(p3)!.set(p4, (partnerCount.get(p3)!.get(p4) ?? 0) + 1);
    partnerCount.get(p4)!.set(p3, (partnerCount.get(p4)!.get(p3) ?? 0) + 1);
  }

  return matches;
}

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
  const { finals_group } = body as { finals_group: string };

  if (!finals_group || !["A", "B", "C"].includes(finals_group)) {
    return NextResponse.json({ error: "finals_group must be A or B" }, { status: 400 });
  }

  const { data: format } = await supabase
    .from("finals_formats")
    .select("id, format_type, status, config")
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group)
    .maybeSingle();

  if (!format) {
    return NextResponse.json({ error: `No format selected for Group ${finals_group}` }, { status: 400 });
  }
  if (format.status !== "configured") {
    return NextResponse.json({ error: "Matches have already been generated" }, { status: 409 });
  }

  let matches: ReturnType<typeof generateFixedPartnerMatches>;

  if (format.format_type === "fixed_partner") {
    const config = format.config as { pairs?: SavedPair[] };
    if (!config?.pairs || config.pairs.length < 2) {
      return NextResponse.json({ error: "Save at least 2 pairs before generating" }, { status: 400 });
    }
    matches = generateFixedPartnerMatches(config.pairs, finals_group, sessionId);
  } else if (format.format_type === "playoffs") {
    // Get group players from participants
    const { data: session } = await supabase
      .from("sessions")
      .select("finals_event_id")
      .eq("id", sessionId)
      .single();

    if (!session?.finals_event_id) {
      return NextResponse.json({ error: "No finals event linked" }, { status: 400 });
    }

    const { data: participants } = await supabase
      .from("finals_participants")
      .select("player_id, group_label")
      .eq("finals_event_id", session.finals_event_id);

    const groupPlayerIds = (participants ?? [])
      .filter((p: { group_label: string }) => p.group_label === finals_group)
      .map((p: { player_id: string }) => p.player_id);

    if (groupPlayerIds.length < 4) {
      return NextResponse.json({ error: "Need at least 4 players in the group" }, { status: 400 });
    }

    matches = generatePlayoffsMatches(groupPlayerIds, finals_group, sessionId);
  } else {
    return NextResponse.json({ error: "Unknown format type" }, { status: 400 });
  }

  if (matches.length === 0) {
    return NextResponse.json({ error: "No matches to generate" }, { status: 400 });
  }

  const { error: insertErr } = await adminDb.from("matches").insert(matches);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const { error: updateErr } = await adminDb
    .from("finals_formats")
    .update({ status: "matches_generated" })
    .eq("id", format.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, matchCount: matches.length, group: finals_group });
}
