/**
 * UBR (Universal Badminton Rating) — core computation engine.
 * Algorithm defined in docs/ubr-algorithm.md (source of truth).
 */
import { supabase as adminDb } from "@/lib/supabase";

// ── Constants (from docs/ubr-algorithm.md §12) ──────────────────────────────

const INITIAL_RD = 350;
const MIN_RD = 50;
const MAX_RD = 350;
const RD_DECAY_C = 15;
const K_PROVISIONAL = 48;   // < 15 matches
const K_ESTABLISHING = 36;  // 15–39 matches
const K_ESTABLISHED = 24;   // 40+ matches
const ELO_DIVISOR = 400;
const TALLY_DISCOUNT = 0.75;
const TALLY_MAX_EFFECTIVE = 8;
const RATING_FLOOR = 1000;
const MARGIN_LOG_BASE = Math.log2(22);
const SIMPLE_MODE_MARGIN = 0.5;

// ── Types ────────────────────────────────────────────────────────────────────

interface UbrState {
  rating: number;
  rd: number;
  matchCount: number;
}

interface MatchRow {
  id: string;
  played_at: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  team1_score: number;
  team2_score: number;
  winning_team: 1 | 2;
}

interface TallyRow {
  player_id: string;
  wins: number;
  losses: number;
}

// ── Tier computation ─────────────────────────────────────────────────────────

export function getTier(rating: number): string {
  if (rating < 2500) return "Shuttle";
  if (rating < 3500) return "Bronze";
  if (rating < 4500) return "Silver";
  if (rating < 5500) return "Gold";
  if (rating < 6500) return "Platinum";
  return "Diamond";
}

// ── Core math ────────────────────────────────────────────────────────────────

function expectedOutcome(rTeam: number, rOpponent: number): number {
  return 1 / (1 + Math.pow(10, (rOpponent - rTeam) / ELO_DIVISOR));
}

function kFactor(matchCount: number, rd: number): number {
  const base = matchCount < 15 ? K_PROVISIONAL
    : matchCount < 40 ? K_ESTABLISHING
    : K_ESTABLISHED;
  return base * (1 + (rd - MIN_RD) / 600);
}

function marginMultiplier(team1Score: number, team2Score: number): number {
  // Simple mode stores 1/0 scores — detect and use neutral
  if ((team1Score <= 1 && team2Score <= 1) || team1Score === team2Score) {
    return SIMPLE_MODE_MARGIN;
  }
  const diff = Math.abs(team1Score - team2Score);
  return Math.log2(1 + diff) / MARGIN_LOG_BASE;
}

function decayRd(rd: number): number {
  return Math.min(MAX_RD, Math.sqrt(rd * rd + RD_DECAY_C * RD_DECAY_C));
}

function reduceRd(rd: number): number {
  // Each match reduces RD — simplified from Glicko
  const d2 = 200 * 200; // match impact variance
  return Math.max(MIN_RD, 1 / Math.sqrt(1 / (rd * rd) + 1 / d2));
}

function initialRating(skillLevel: number): number {
  return 1500 + skillLevel * 1000;
}

// ── Match-based update (§5) ──────────────────────────────────────────────────

function processMatch(
  states: Map<string, UbrState>,
  match: MatchRow,
): void {
  const t1 = [match.team1_player1_id, match.team1_player2_id];
  const t2 = [match.team2_player1_id, match.team2_player2_id];

  const getState = (id: string) => states.get(id)!;

  const rTeam1 = (getState(t1[0]).rating + getState(t1[1]).rating) / 2;
  const rTeam2 = (getState(t2[0]).rating + getState(t2[1]).rating) / 2;

  const e1 = expectedOutcome(rTeam1, rTeam2);
  const e2 = 1 - e1;

  const s1 = match.winning_team === 1 ? 1.0 : 0.0;
  const s2 = 1.0 - s1;

  const mm = marginMultiplier(match.team1_score, match.team2_score);
  const scaledMargin = 0.5 + mm;

  // Update each player
  for (const pid of t1) {
    const s = getState(pid);
    const k = kFactor(s.matchCount, s.rd);
    const delta = k * (s1 - e1) * scaledMargin;
    s.rating = Math.max(RATING_FLOOR, s.rating + delta);
    s.rd = reduceRd(s.rd);
    s.matchCount++;
  }

  for (const pid of t2) {
    const s = getState(pid);
    const k = kFactor(s.matchCount, s.rd);
    const delta = k * (s2 - e2) * scaledMargin;
    s.rating = Math.max(RATING_FLOOR, s.rating + delta);
    s.rd = reduceRd(s.rd);
    s.matchCount++;
  }
}

// ── Tally-based update (§6) ──────────────────────────────────────────────────

function processTallySession(
  states: Map<string, UbrState>,
  tallyRows: TallyRow[],
): void {
  const active = tallyRows.filter((t) => t.wins + t.losses > 0);
  if (active.length === 0) return;

  // Session pool rating
  const poolRating =
    active.reduce((sum, t) => sum + (states.get(t.player_id)?.rating ?? 2500), 0) /
    active.length;

  for (const t of active) {
    const s = states.get(t.player_id);
    if (!s) continue;

    const total = t.wins + t.losses;
    const actualWinRate = t.wins / total;
    const expectedWinRate = expectedOutcome(s.rating, poolRating);
    const effectiveMatches = Math.min(Math.floor(total / 2), TALLY_MAX_EFFECTIVE);

    const k = kFactor(s.matchCount, s.rd);
    const kTally = k * TALLY_DISCOUNT;
    const delta = kTally * effectiveMatches * (actualWinRate - expectedWinRate);

    s.rating = Math.max(RATING_FLOOR, s.rating + delta);
    s.rd = reduceRd(s.rd);
    s.matchCount += effectiveMatches;
  }
}

// ── Full recalculation from scratch (§9) ─────────────────────────────────────

export async function recalculateAllUbr(): Promise<void> {
  // 1. Fetch all players with skill levels
  const { data: players } = await adminDb
    .from("players")
    .select("id, skill_level")
    .is("deleted_at", null);

  if (!players || players.length === 0) return;

  // Initialize all player states
  const states = new Map<string, UbrState>();
  for (const p of players) {
    states.set(p.id, {
      rating: initialRating(p.skill_level),
      rd: INITIAL_RD,
      matchCount: 0,
    });
  }

  // 2. Fetch all finalized non-test sessions in date order
  const { data: sessions } = await adminDb
    .from("sessions")
    .select("id, date, whiteboard_mode")
    .eq("status", "completed")
    .eq("is_test_session", false)
    .order("date", { ascending: true });

  if (!sessions || sessions.length === 0) return;

  // 3. Fetch all session participants (for RD decay)
  const { data: allSp } = await adminDb
    .from("session_players")
    .select("session_id, player_id");

  const sessionParticipants = new Map<string, Set<string>>();
  for (const sp of allSp ?? []) {
    if (!sessionParticipants.has(sp.session_id)) {
      sessionParticipants.set(sp.session_id, new Set());
    }
    sessionParticipants.get(sp.session_id)!.add(sp.player_id);
  }

  // 4. Fetch all matches
  const { data: allMatches } = await adminDb
    .from("matches")
    .select("id, session_id, played_at, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score, winning_team")
    .eq("match_type", "regular")
    .order("played_at", { ascending: true });

  const matchesBySession = new Map<string, MatchRow[]>();
  for (const m of allMatches ?? []) {
    if (!matchesBySession.has(m.session_id)) {
      matchesBySession.set(m.session_id, []);
    }
    matchesBySession.get(m.session_id)!.push(m as MatchRow);
  }

  // 5. Fetch all tally data
  const { data: allTally } = await adminDb
    .from("session_tally")
    .select("session_id, player_id, wins, losses");

  const tallyBySession = new Map<string, TallyRow[]>();
  for (const t of allTally ?? []) {
    if (!tallyBySession.has(t.session_id)) {
      tallyBySession.set(t.session_id, []);
    }
    tallyBySession.get(t.session_id)!.push(t);
  }

  // Clear existing history
  await adminDb.from("ubr_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 6. Process each session sequentially
  const historyBatch: Array<{
    player_id: string;
    session_id: string;
    rating_before: number;
    rating_after: number;
    rating_change: number;
    match_count: number;
  }> = [];

  for (const session of sessions) {
    const participants = sessionParticipants.get(session.id) ?? new Set();

    // Decay RD for absent players
    for (const [pid, state] of states) {
      if (!participants.has(pid)) {
        state.rd = decayRd(state.rd);
      }
    }

    // Ensure all participants have state (handles players added after initial load)
    for (const pid of participants) {
      if (!states.has(pid)) {
        const player = players.find((p) => p.id === pid);
        states.set(pid, {
          rating: initialRating(player?.skill_level ?? 2),
          rd: INITIAL_RD,
          matchCount: 0,
        });
      }
    }

    // Snapshot before
    const before = new Map<string, number>();
    for (const pid of participants) {
      before.set(pid, states.get(pid)!.rating);
    }

    // Process
    const matches = matchesBySession.get(session.id);
    const tally = tallyBySession.get(session.id);

    if (matches && matches.length > 0) {
      // Match-based: process each match chronologically
      // Ensure all match players have state
      for (const m of matches) {
        for (const pid of [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]) {
          if (!states.has(pid)) {
            const player = players.find((p) => p.id === pid);
            states.set(pid, {
              rating: initialRating(player?.skill_level ?? 2),
              rd: INITIAL_RD,
              matchCount: 0,
            });
          }
        }
        processMatch(states, m);
      }
    } else if (tally && tally.length > 0) {
      // Tally-only: pool method
      for (const t of tally) {
        if (!states.has(t.player_id)) {
          const player = players.find((p) => p.id === t.player_id);
          states.set(t.player_id, {
            rating: initialRating(player?.skill_level ?? 2),
            rd: INITIAL_RD,
            matchCount: 0,
          });
        }
      }
      processTallySession(states, tally);
    } else {
      continue; // No data for this session
    }

    // Record history for participants who played
    for (const pid of participants) {
      const ratingBefore = before.get(pid) ?? states.get(pid)!.rating;
      const ratingAfter = states.get(pid)!.rating;
      if (ratingBefore !== ratingAfter) {
        historyBatch.push({
          player_id: pid,
          session_id: session.id,
          rating_before: ratingBefore,
          rating_after: ratingAfter,
          rating_change: ratingAfter - ratingBefore,
          match_count: states.get(pid)!.matchCount,
        });
      }
    }
  }

  // 7. Write results
  // Upsert current ratings
  const ratingRows = Array.from(states.entries()).map(([pid, s]) => ({
    player_id: pid,
    rating: Math.round(s.rating * 100) / 100,
    rating_deviation: Math.round(s.rd * 100) / 100,
    match_count: s.matchCount,
    tier: getTier(s.rating),
    updated_at: new Date().toISOString(),
  }));

  // Batch upsert in chunks (Supabase has row limits)
  for (let i = 0; i < ratingRows.length; i += 500) {
    await adminDb.from("ubr_ratings").upsert(ratingRows.slice(i, i + 500), { onConflict: "player_id" });
  }

  // Insert history
  if (historyBatch.length > 0) {
    for (let i = 0; i < historyBatch.length; i += 500) {
      await adminDb.from("ubr_history").insert(historyBatch.slice(i, i + 500));
    }
  }
}

// ── Single-session incremental update (§7) ───────────────────────────────────

export async function processSessionUbr(sessionId: string): Promise<void> {
  // Check if session is eligible
  const { data: session } = await adminDb
    .from("sessions")
    .select("id, status, is_test_session, whiteboard_mode")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "completed" || session.is_test_session) return;

  // Fetch participants
  const { data: spRows } = await adminDb
    .from("session_players")
    .select("player_id")
    .eq("session_id", sessionId);

  const participantIds = new Set((spRows ?? []).map((r) => r.player_id));
  if (participantIds.size === 0) return;

  // Fetch matches for this session
  const { data: matches } = await adminDb
    .from("matches")
    .select("id, played_at, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score, winning_team")
    .eq("session_id", sessionId)
    .eq("match_type", "regular")
    .order("played_at", { ascending: true });

  // Fetch tally for this session
  const { data: tally } = await adminDb
    .from("session_tally")
    .select("player_id, wins, losses")
    .eq("session_id", sessionId);

  const hasMatches = matches && matches.length > 0;
  const hasTally = tally && tally.length > 0;
  if (!hasMatches && !hasTally) return;

  // Collect all player IDs involved (participants + match players)
  const allPlayerIds = new Set(participantIds);
  if (hasMatches) {
    for (const m of matches) {
      allPlayerIds.add(m.team1_player1_id);
      allPlayerIds.add(m.team1_player2_id);
      allPlayerIds.add(m.team2_player1_id);
      allPlayerIds.add(m.team2_player2_id);
    }
  }

  // Load current UBR states for involved players
  const { data: existingRatings } = await adminDb
    .from("ubr_ratings")
    .select("player_id, rating, rating_deviation, match_count")
    .in("player_id", Array.from(allPlayerIds));

  // Load skill levels for players without UBR
  const { data: playerSkills } = await adminDb
    .from("players")
    .select("id, skill_level")
    .in("id", Array.from(allPlayerIds));

  const skillMap = new Map((playerSkills ?? []).map((p) => [p.id, p.skill_level]));

  // Build state map
  const states = new Map<string, UbrState>();
  const existingMap = new Map((existingRatings ?? []).map((r) => [r.player_id, r]));

  for (const pid of allPlayerIds) {
    const existing = existingMap.get(pid);
    if (existing) {
      states.set(pid, {
        rating: Number(existing.rating),
        rd: Number(existing.rating_deviation),
        matchCount: existing.match_count,
      });
    } else {
      states.set(pid, {
        rating: initialRating(skillMap.get(pid) ?? 2),
        rd: INITIAL_RD,
        matchCount: 0,
      });
    }
  }

  // Decay RD for all players with existing ratings who are NOT in this session
  // (lightweight: only for players we already loaded)
  // Full decay across all players happens during recalculateAllUbr

  // Snapshot before
  const before = new Map<string, number>();
  for (const pid of allPlayerIds) {
    before.set(pid, states.get(pid)!.rating);
  }

  // Process
  if (hasMatches) {
    for (const m of matches) {
      processMatch(states, m as MatchRow);
    }
  } else if (hasTally) {
    processTallySession(states, tally);
  }

  // Write updated ratings
  const updatedRows = Array.from(states.entries())
    .filter(([pid]) => {
      const b = before.get(pid);
      const a = states.get(pid)!;
      return b !== a.rating || !existingMap.has(pid);
    })
    .map(([pid, s]) => ({
      player_id: pid,
      rating: Math.round(s.rating * 100) / 100,
      rating_deviation: Math.round(s.rd * 100) / 100,
      match_count: s.matchCount,
      tier: getTier(s.rating),
      updated_at: new Date().toISOString(),
    }));

  if (updatedRows.length > 0) {
    await adminDb.from("ubr_ratings").upsert(updatedRows, { onConflict: "player_id" });
  }

  // Write history
  const historyRows = Array.from(states.entries())
    .filter(([pid]) => {
      const b = before.get(pid) ?? states.get(pid)!.rating;
      return b !== states.get(pid)!.rating;
    })
    .map(([pid, s]) => ({
      player_id: pid,
      session_id: sessionId,
      rating_before: Math.round((before.get(pid) ?? s.rating) * 100) / 100,
      rating_after: Math.round(s.rating * 100) / 100,
      rating_change: Math.round((s.rating - (before.get(pid) ?? s.rating)) * 100) / 100,
      match_count: s.matchCount,
    }));

  if (historyRows.length > 0) {
    await adminDb.from("ubr_history").upsert(historyRows, { onConflict: "player_id,session_id" });
  }
}

// ── Query helpers ────────────────────────────────────────────────────────────

export interface UbrRating {
  player_id: string;
  rating: number;
  rating_deviation: number;
  match_count: number;
  tier: string;
}

export async function getAllUbrRatings(): Promise<Map<string, UbrRating>> {
  const { data } = await adminDb
    .from("ubr_ratings")
    .select("player_id, rating, rating_deviation, match_count, tier");

  const map = new Map<string, UbrRating>();
  for (const r of data ?? []) {
    map.set(r.player_id, {
      player_id: r.player_id,
      rating: Number(r.rating),
      rating_deviation: Number(r.rating_deviation),
      match_count: r.match_count,
      tier: r.tier,
    });
  }
  return map;
}

export async function getPlayerUbrHistory(
  playerId: string
): Promise<Array<{ session_id: string; rating_before: number; rating_after: number; rating_change: number; created_at: string; session_date: string }>> {
  const { data } = await adminDb
    .from("ubr_history")
    .select("session_id, rating_before, rating_after, rating_change, created_at, sessions(date)")
    .eq("player_id", playerId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    session_id: r.session_id,
    rating_before: Number(r.rating_before),
    rating_after: Number(r.rating_after),
    rating_change: Number(r.rating_change),
    created_at: r.created_at,
    session_date: (r.sessions as unknown as { date: string }).date,
  }));
}

export async function getPlayerUbrRating(playerId: string): Promise<UbrRating | null> {
  const { data } = await adminDb
    .from("ubr_ratings")
    .select("player_id, rating, rating_deviation, match_count, tier")
    .eq("player_id", playerId)
    .maybeSingle();

  if (!data) return null;
  return {
    player_id: data.player_id,
    rating: Number(data.rating),
    rating_deviation: Number(data.rating_deviation),
    match_count: data.match_count,
    tier: data.tier,
  };
}
