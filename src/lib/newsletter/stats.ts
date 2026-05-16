import { supabase as adminDb } from "@/lib/supabase";

export interface PlayerRow {
  id: string;
  name: string;
  skill_level: number;
  gender: string;
  wins: number;
  losses: number;
  games: number;
  win_pct: number;
  sessions_attended: number;
  ubr_start: number | null;
  ubr_end: number | null;
  ubr_delta: number | null;
}

export interface PairRow {
  player1: string;
  player2: string;
  s1: number;
  s2: number;
  games: number;
  wins: number;
  losses: number;
  win_pct: number;
}

export interface SeasonStatsSnapshot {
  season_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  lock_date: string | null;
  real_session_count: number;
  full_detail_session_count: number;  // sessions with per-match team rosters and scores
  tally_session_count: number;        // whiteboard-tally sessions (no individual matches)
  scored_match_count: number;
  total_player_outcomes: number;      // sum of all W+L across all players (across both modes)
  avg_margin: number | null;
  close_matches: number;
  blowouts: number;
  bagels: number;
  unique_players: number;
  perfect_attendance: { name: string; sessions_attended: number }[];
  players: PlayerRow[];
  pairs: PairRow[];
}

interface RawSeason {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  stats_lock_date: string | null;
}

interface RawSession {
  id: string;
  date: string;
}

interface RawPlayer {
  id: string;
  name: string;
  skill_level: number;
  gender: string;
  deleted_at: string | null;
  onboarding_complete: boolean | null;
}

interface RawMatch {
  id: string;
  session_id: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  team1_score: number;
  team2_score: number;
  winning_team: number | null;
}

interface RawTally {
  player_id: string;
  session_id: string;
  wins: number;
  losses: number;
}

interface RawAttendance {
  player_id: string;
  session_id: string;
}

interface RawUbrHistory {
  player_id: string;
  session_id: string;
  rating_before: string | number;
  rating_after: string | number;
}

/**
 * Aggregates one season into a stats snapshot. Mirrors the leaderboard's
 * accounting so the newsletter numbers line up with what users see on
 * /leaderboard:
 *   - non-test sessions only
 *   - on or before `stats_lock_date` (if set)
 *   - per-player wins/losses = sum(match wins/losses) + sum(tally wins/losses)
 *   - matches involving any soft-deleted player are excluded
 *   - only onboarding-complete, non-deleted players appear in the output
 */
export async function getSeasonStats(seasonId: string): Promise<SeasonStatsSnapshot> {
  const { data: seasonRow, error: seasonErr } = await adminDb
    .from("seasons")
    .select("id, name, start_date, end_date, stats_lock_date")
    .eq("id", seasonId)
    .single();
  if (seasonErr || !seasonRow) throw new Error(`Season not found: ${seasonId}`);
  const season = seasonRow as RawSeason;
  const lockDate = season.stats_lock_date;

  // Eligible sessions: non-test, on or before the stats lock date (if set).
  // We deliberately do NOT filter by session.status or session_type — the
  // leaderboard doesn't either; the match_type filter on `matches` and the
  // absence of tally rows on non-played sessions handle that.
  let sessionsQuery = adminDb
    .from("sessions")
    .select("id, date")
    .eq("season_id", seasonId)
    .eq("is_test_session", false);
  if (lockDate) sessionsQuery = sessionsQuery.lte("date", lockDate);
  const { data: sessionRows, error: sessionsErr } = await sessionsQuery;
  if (sessionsErr) throw sessionsErr;
  const sessions = (sessionRows ?? []) as RawSession[];
  const sessionIds = sessions.map((s) => s.id);
  const sessionDateById = new Map(sessions.map((s) => [s.id, s.date]));

  const empty: SeasonStatsSnapshot = {
    season_id: seasonId,
    season_name: season.name,
    start_date: season.start_date,
    end_date: season.end_date,
    lock_date: lockDate,
    real_session_count: 0,
    full_detail_session_count: 0,
    tally_session_count: 0,
    scored_match_count: 0,
    total_player_outcomes: 0,
    avg_margin: null,
    close_matches: 0,
    blowouts: 0,
    bagels: 0,
    unique_players: 0,
    perfect_attendance: [],
    players: [],
    pairs: [],
  };
  if (sessionIds.length === 0) return empty;

  const [
    { data: matchRows },
    { data: tallyRows },
    { data: attendanceRows },
    { data: ubrRows },
    { data: playerRows },
  ] = await Promise.all([
    adminDb
      .from("matches")
      .select("id, session_id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score, winning_team")
      .in("session_id", sessionIds)
      .eq("match_type", "regular"),
    adminDb
      .from("session_tally")
      .select("player_id, session_id, wins, losses")
      .in("session_id", sessionIds),
    adminDb
      .from("session_players")
      .select("player_id, session_id")
      .in("session_id", sessionIds),
    adminDb
      .from("ubr_history")
      .select("player_id, session_id, rating_before, rating_after")
      .in("session_id", sessionIds),
    adminDb
      .from("players")
      .select("id, name, skill_level, gender, deleted_at, onboarding_complete"),
  ]);

  const matches = (matchRows ?? []) as RawMatch[];
  const tallies = (tallyRows ?? []) as RawTally[];
  const attendance = (attendanceRows ?? []) as RawAttendance[];
  const ubrHistory = (ubrRows ?? []) as RawUbrHistory[];
  const players = (playerRows ?? []) as RawPlayer[];
  const playerById = new Map(players.map((p) => [p.id, p]));
  const deletedIds = new Set(players.filter((p) => p.deleted_at != null).map((p) => p.id));

  // Two classes of sessions:
  //   - full-detail: per-match rosters and scores recorded (matches table)
  //   - tally-only: whiteboard-mode nights with aggregate W/L per player (session_tally)
  const fullDetailSessions = new Set<string>();
  const tallySessions = new Set<string>();
  for (const m of matches) if (m.winning_team != null) fullDetailSessions.add(m.session_id);
  for (const t of tallies) if ((t.wins ?? 0) + (t.losses ?? 0) > 0) tallySessions.add(t.session_id);
  // A session that has both somehow counts as full-detail (more granular).
  for (const sid of fullDetailSessions) tallySessions.delete(sid);
  const sessionsWithResults = new Set<string>([...fullDetailSessions, ...tallySessions]);

  // Match-level fun stats over scored matches.
  let scoredCount = 0, totalMargin = 0, close = 0, blow = 0, bagels = 0;
  for (const m of matches) {
    if (m.winning_team == null) continue;
    if (m.team1_score === 0 && m.team2_score === 0) continue;
    const diff = Math.abs(m.team1_score - m.team2_score);
    scoredCount += 1;
    totalMargin += diff;
    if (diff <= 2) close += 1;
    if (diff >= 10) blow += 1;
    if (Math.min(m.team1_score, m.team2_score) === 0) bagels += 1;
  }

  // Per-player wins/losses — SUM of matches + tallies, exactly like the
  // leaderboard (getActivePlayers in src/lib/db/players.ts).
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  function bump(map: Map<string, number>, key: string, delta: number = 1) {
    map.set(key, (map.get(key) ?? 0) + delta);
  }
  for (const m of matches) {
    if (m.winning_team == null) continue;
    // Skip matches that include any soft-deleted player — leaderboard does the same.
    if (
      deletedIds.has(m.team1_player1_id) ||
      deletedIds.has(m.team1_player2_id) ||
      deletedIds.has(m.team2_player1_id) ||
      deletedIds.has(m.team2_player2_id)
    ) continue;
    const t1 = [m.team1_player1_id, m.team1_player2_id];
    const t2 = [m.team2_player1_id, m.team2_player2_id];
    const winners = m.winning_team === 1 ? t1 : t2;
    const losers = m.winning_team === 1 ? t2 : t1;
    for (const id of winners) bump(wins, id);
    for (const id of losers) bump(losses, id);
  }
  for (const t of tallies) {
    if ((t.wins ?? 0) === 0 && (t.losses ?? 0) === 0) continue;
    bump(wins, t.player_id, t.wins ?? 0);
    bump(losses, t.player_id, t.losses ?? 0);
  }

  // Attendance — unique sessions per player. A player counts as having "been
  // there" if they have a session_players row OR a session_tally row with any
  // games recorded. Pure session_players misses whiteboard-tally nights where
  // people didn't formally check in.
  const attendBy = new Map<string, Set<string>>();
  function markAttend(player_id: string, session_id: string) {
    if (!attendBy.has(player_id)) attendBy.set(player_id, new Set());
    attendBy.get(player_id)!.add(session_id);
  }
  for (const a of attendance) markAttend(a.player_id, a.session_id);
  for (const t of tallies) {
    if ((t.wins ?? 0) + (t.losses ?? 0) > 0) markAttend(t.player_id, t.session_id);
  }
  // Match rosters also imply attendance (covers checkin-skipped detail nights).
  for (const m of matches) {
    if (m.winning_team == null) continue;
    [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
      .forEach((pid) => markAttend(pid, m.session_id));
  }

  // UBR first/last for the season window.
  const ubrSorted = [...ubrHistory].sort((a, b) => {
    const da = sessionDateById.get(a.session_id) ?? "";
    const db = sessionDateById.get(b.session_id) ?? "";
    return da.localeCompare(db);
  });
  const firstUbr = new Map<string, number>();
  const lastUbr = new Map<string, number>();
  for (const h of ubrSorted) {
    const before = typeof h.rating_before === "string" ? parseFloat(h.rating_before) : h.rating_before;
    const after = typeof h.rating_after === "string" ? parseFloat(h.rating_after) : h.rating_after;
    if (!firstUbr.has(h.player_id)) firstUbr.set(h.player_id, before);
    lastUbr.set(h.player_id, after);
  }

  // Player roster: onboarding-complete, non-deleted — same filter as leaderboard.
  const playerRowsOut: PlayerRow[] = [];
  for (const p of players) {
    if (p.deleted_at) continue;
    if (p.onboarding_complete !== true) continue;
    const w = wins.get(p.id) ?? 0;
    const l = losses.get(p.id) ?? 0;
    const games = w + l;
    const attended = attendBy.get(p.id)?.size ?? 0;
    if (games === 0 && attended === 0) continue;
    const ubrStart = firstUbr.get(p.id) ?? null;
    const ubrEnd = lastUbr.get(p.id) ?? null;
    const ubrDelta = ubrStart != null && ubrEnd != null ? Math.round(ubrEnd - ubrStart) : null;
    playerRowsOut.push({
      id: p.id,
      name: p.name,
      skill_level: p.skill_level,
      gender: p.gender,
      wins: w,
      losses: l,
      games,
      win_pct: games > 0 ? Math.round((1000 * w) / games) / 10 : 0,
      sessions_attended: attended,
      ubr_start: ubrStart != null ? Math.round(ubrStart) : null,
      ubr_end: ubrEnd != null ? Math.round(ubrEnd) : null,
      ubr_delta: ubrDelta,
    });
  }

  // Partner pairs — match-only (tally rows carry no partner info). Skip pairs
  // involving any soft-deleted player so the surface aligns with leaderboard.
  const pairMap = new Map<string, { games: number; wins: number; p1: string; p2: string }>();
  for (const m of matches) {
    if (m.winning_team == null) continue;
    if (
      deletedIds.has(m.team1_player1_id) ||
      deletedIds.has(m.team1_player2_id) ||
      deletedIds.has(m.team2_player1_id) ||
      deletedIds.has(m.team2_player2_id)
    ) continue;
    const pairs: { a: string; b: string; won: boolean }[] = [
      { a: m.team1_player1_id, b: m.team1_player2_id, won: m.winning_team === 1 },
      { a: m.team2_player1_id, b: m.team2_player2_id, won: m.winning_team === 2 },
    ];
    for (const { a, b, won } of pairs) {
      const [p1, p2] = a < b ? [a, b] : [b, a];
      const key = `${p1}|${p2}`;
      if (!pairMap.has(key)) pairMap.set(key, { games: 0, wins: 0, p1, p2 });
      const slot = pairMap.get(key)!;
      slot.games += 1;
      if (won) slot.wins += 1;
    }
  }
  const pairsOut: PairRow[] = [];
  for (const slot of pairMap.values()) {
    if (slot.games < 3) continue;
    const a = playerById.get(slot.p1);
    const b = playerById.get(slot.p2);
    if (!a || !b) continue;
    pairsOut.push({
      player1: a.name,
      player2: b.name,
      s1: a.skill_level,
      s2: b.skill_level,
      games: slot.games,
      wins: slot.wins,
      losses: slot.games - slot.wins,
      win_pct: Math.round((1000 * slot.wins) / slot.games) / 10,
    });
  }
  pairsOut.sort((x, y) => y.games - x.games || y.wins - x.wins);

  // "Real session count" = sessions that actually produced results in scope.
  // Perfect-attendance is measured against that denominator.
  const realSessionCount = sessionsWithResults.size;
  const perfect = playerRowsOut
    .filter((p) => realSessionCount > 0 && Array.from(attendBy.get(p.id) ?? []).filter((sid) => sessionsWithResults.has(sid)).length === realSessionCount)
    .map((p) => ({ name: p.name, sessions_attended: realSessionCount }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalOutcomes = playerRowsOut.reduce((s, p) => s + p.games, 0);

  return {
    season_id: seasonId,
    season_name: season.name,
    start_date: season.start_date,
    end_date: season.end_date,
    lock_date: lockDate,
    real_session_count: realSessionCount,
    full_detail_session_count: fullDetailSessions.size,
    tally_session_count: tallySessions.size,
    scored_match_count: scoredCount,
    total_player_outcomes: totalOutcomes,
    avg_margin: scoredCount > 0 ? Math.round((10 * totalMargin) / scoredCount) / 10 : null,
    close_matches: close,
    blowouts: blow,
    bagels,
    unique_players: playerRowsOut.length,
    perfect_attendance: perfect,
    players: playerRowsOut,
    pairs: pairsOut,
  };
}
