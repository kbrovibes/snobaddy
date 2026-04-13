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

// ── Playoffs: rotating partners, EXACTLY N matches per player ────────────────
// Uses a deck-based algorithm: each player appears matchesPerPlayer times in a
// shuffled deck, dealt into groups of 4. Duplicates within a group are resolved
// by swapping with later positions. Retries with fresh shuffles if stuck.
function generatePlayoffsMatches(
  playerIds: string[],
  groupLabel: string,
  sessionId: string,
  matchesPerPlayer: number
) {
  const n = playerIds.length;
  if (n < 4) return [];

  // Fast path: exactly 4 players → deterministic all-play-all (3 matches)
  if (n === 4 && matchesPerPlayer === 3) {
    const [a, b, c, d] = playerIds;
    return [
      { session_id: sessionId, team1_player1_id: a, team1_player2_id: b, team2_player1_id: c, team2_player2_id: d, match_type: "finals_group", finals_group: groupLabel },
      { session_id: sessionId, team1_player1_id: a, team1_player2_id: c, team2_player1_id: b, team2_player2_id: d, match_type: "finals_group", finals_group: groupLabel },
      { session_id: sessionId, team1_player1_id: a, team1_player2_id: d, team2_player1_id: b, team2_player2_id: c, match_type: "finals_group", finals_group: groupLabel },
    ];
  }

  const totalMatches = (matchesPerPlayer * n) / 4;

  // Try up to 50 shuffles to find a valid deal
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = tryDeal(playerIds, totalMatches, matchesPerPlayer, groupLabel, sessionId);
    if (result) return result;
  }

  // Should never reach here for valid inputs, but return empty as safety
  return [];
}

function tryDeal(
  playerIds: string[],
  totalMatches: number,
  matchesPerPlayer: number,
  groupLabel: string,
  sessionId: string
) {
  // Build deck: each player appears exactly matchesPerPlayer times
  const deck: string[] = [];
  for (const id of playerIds) {
    for (let i = 0; i < matchesPerPlayer; i++) {
      deck.push(id);
    }
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal into groups of 4, fixing duplicates by swapping with later positions
  const groups: [string, string, string, string][] = [];

  for (let m = 0; m < totalMatches; m++) {
    const start = m * 4;
    // Fix duplicates within this group
    for (let i = start; i < start + 4; i++) {
      // Check if deck[i] already appears in positions start..i-1
      let hasDup = false;
      for (let j = start; j < i; j++) {
        if (deck[i] === deck[j]) { hasDup = true; break; }
      }
      if (!hasDup) continue;

      // Find a swap candidate in remaining deck (positions after this group)
      let swapped = false;
      for (let k = start + 4; k < deck.length; k++) {
        // Candidate must not duplicate anything already in this group (start..i-1)
        let candidateOk = true;
        for (let j = start; j < i; j++) {
          if (deck[k] === deck[j]) { candidateOk = false; break; }
        }
        if (!candidateOk) continue;

        // Also check: swapping deck[i] into position k won't break k's future group
        // (We check the group that position k belongs to)
        const kGroup = Math.floor(k / 4);
        const kGroupStart = kGroup * 4;
        let swapOk = true;
        // Check if deck[i] (the value we're putting at position k) would duplicate
        // anything already fixed in k's group (positions kGroupStart..k-1 if they're in the same group)
        if (kGroup > m) {
          // k's group hasn't been processed yet, so only check already-dealt positions
          // which is none — safe to swap
        } else {
          // k is in current group range (shouldn't happen since k >= start+4), skip
          swapOk = false;
        }

        if (swapOk) {
          [deck[i], deck[k]] = [deck[k], deck[i]];
          swapped = true;
          break;
        }
      }

      if (!swapped) {
        // This shuffle can't produce a valid deal — caller will retry
        return null;
      }
    }

    groups.push([deck[start], deck[start + 1], deck[start + 2], deck[start + 3]]);
  }

  // Validate: every player must appear exactly matchesPerPlayer times
  const counts = new Map<string, number>();
  for (const g of groups) {
    for (const id of g) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  for (const id of playerIds) {
    if ((counts.get(id) ?? 0) !== matchesPerPlayer) return null;
  }

  // Build match objects, choosing team splits that maximize partner diversity
  const partnerCount = new Map<string, Map<string, number>>();
  for (const id of playerIds) partnerCount.set(id, new Map());

  const matches: {
    session_id: string;
    team1_player1_id: string;
    team1_player2_id: string;
    team2_player1_id: string;
    team2_player2_id: string;
    match_type: string;
    finals_group: string;
  }[] = [];

  for (const [a, b, c, d] of groups) {
    // Try all 3 possible team splits, pick the one with least partner repetition
    const splits: [string, string, string, string][] = [
      [a, b, c, d], // (a,b) vs (c,d)
      [a, c, b, d], // (a,c) vs (b,d)
      [a, d, b, c], // (a,d) vs (b,c)
    ];

    let bestSplit = splits[0];
    let bestScore = -Infinity;
    for (const s of splits) {
      const penalty =
        (partnerCount.get(s[0])?.get(s[1]) ?? 0) +
        (partnerCount.get(s[2])?.get(s[3]) ?? 0);
      const score = -penalty + Math.random() * 0.1; // tiny tiebreaker
      if (score > bestScore) {
        bestScore = score;
        bestSplit = s;
      }
    }

    const [p1, p2, p3, p4] = bestSplit;
    matches.push({
      session_id: sessionId,
      team1_player1_id: p1,
      team1_player2_id: p2,
      team2_player1_id: p3,
      team2_player2_id: p4,
      match_type: "finals_group",
      finals_group: groupLabel,
    });

    // Track partnerships
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

    const config = format.config as { matches_per_player?: number };
    const mpp = config?.matches_per_player ?? groupPlayerIds.length; // fallback to old behavior
    if ((mpp * groupPlayerIds.length) % 4 !== 0) {
      return NextResponse.json(
        { error: `matches_per_player (${mpp}) × players (${groupPlayerIds.length}) must be divisible by 4` },
        { status: 400 }
      );
    }
    matches = generatePlayoffsMatches(groupPlayerIds, finals_group, sessionId, mpp);
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
