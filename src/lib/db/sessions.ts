import { createClient } from "@/lib/supabase-server";

export interface Session {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  auto_generate_matches?: boolean;
  simple_score_tracking: boolean;
  is_test_session: boolean;
  tally_photo_path: string | null;
  season: { id: string; name: string };
  session_type?: "regular" | "finals";
  finals_event_id?: string | null;
  whiteboard_mode: boolean;
  stats_lock_date: string | null;
}

export interface SessionRow {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  is_test_session: boolean;
  season: { name: string };
  match_count: number;
  tally_count: number;
  stats_lock_date: string | null;
}

export interface CheckedInPlayer {
  player_id: string;
  name: string;
  skill_level: number;
  checked_in_at: string;
  user_id: string | null;
  is_admin: boolean;
}

export interface SessionPresence {
  player_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

/** Today's date in Pacific time (YYYY-MM-DD). All session date logic must use this. */
function todayPacific(): string {
  // "en-CA" locale gives YYYY-MM-DD; timeZone ensures Pacific calendar day
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export async function getTodaySession(): Promise<Session | null> {
  const supabase = await createClient();
  const today = todayPacific();

  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, is_test_session, seasons(id, name)")
    .eq("date", today)
    .maybeSingle();

  if (!data) return null;
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, stats_lock_date: null, season: (data.seasons as unknown as Session["season"]) };
}

export async function getUpcomingSession(): Promise<Session | null> {
  const supabase = await createClient();
  const today = todayPacific();

  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, is_test_session, seasons(id, name)")
    .gt("date", today)
    .order("date")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, stats_lock_date: null, season: (data.seasons as unknown as Session["season"]) };
}

export async function getActiveSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, is_test_session, seasons(id, name)")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, stats_lock_date: null, season: (data.seasons as unknown as Session["season"]) };
}

export async function getAllSessions(seasonId?: string): Promise<SessionRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("sessions")
    .select("id, date, status, is_test_session, session_type, seasons(name), matches(count), session_tally(count)")
    .order("date", { ascending: false });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data } = await query;
  if (!data) return [];
  return data
    .filter((row) => (row as unknown as { session_type?: string }).session_type !== "finals")
    .map((row) => ({
      id: row.id,
      date: row.date,
      status: row.status as SessionRow["status"],
      is_test_session: row.is_test_session ?? false,
      season: (row.seasons as unknown as { name: string }),
      match_count: (row.matches as unknown as { count: number }[])?.[0]?.count ?? 0,
      tally_count: (row.session_tally as unknown as { count: number }[])?.[0]?.count ?? 0,
      stats_lock_date: (row as unknown as { stats_lock_date?: string | null }).stats_lock_date ?? null,
    }));
}

export async function getSessionById(id: string): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, date, status, auto_generate_matches, simple_score_tracking, is_test_session, tally_photo_path, session_type, finals_event_id, whiteboard_mode, seasons(id, name)")
    .eq("id", id)
    .maybeSingle();

  // If the query errored (e.g. column not yet migrated), retry without new columns
  if (error || !data) {
    if (!error) return null; // no error, just no row
    const { data: fallback } = await supabase
      .from("sessions")
      .select("id, date, status, auto_generate_matches, seasons(id, name)")
      .eq("id", id)
      .maybeSingle();
    if (!fallback) return null;
    const fb = fallback as typeof fallback & { auto_generate_matches?: boolean };
    return {
      ...fallback,
      auto_generate_matches: fb.auto_generate_matches ?? true,
      simple_score_tracking: true,
      is_test_session: false,
      tally_photo_path: null,
      whiteboard_mode: true,
      stats_lock_date: null,
      season: (fallback.seasons as unknown as Session["season"]),
    };
  }

  const row = data as typeof data & { auto_generate_matches?: boolean; simple_score_tracking?: boolean; is_test_session?: boolean; tally_photo_path?: string | null; session_type?: string; finals_event_id?: string | null; whiteboard_mode?: boolean; stats_lock_date?: string | null };
  return {
    ...data,
    auto_generate_matches: row.auto_generate_matches ?? true,
    simple_score_tracking: row.simple_score_tracking ?? true,
    is_test_session: row.is_test_session ?? false,
    tally_photo_path: row.tally_photo_path ?? null,
    session_type: (row.session_type as "regular" | "finals" | undefined) ?? "regular",
    finals_event_id: row.finals_event_id ?? null,
    whiteboard_mode: row.whiteboard_mode ?? true,
    stats_lock_date: row.stats_lock_date ?? null,
    season: (data.seasons as unknown as Session["season"]),
  };
}

export async function getAdjacentNonTestSessions(
  currentDate: string,
): Promise<{ newer: { id: string; date: string } | null; older: { id: string; date: string } | null }> {
  const supabase = await createClient();
  const [{ data: newerData }, { data: olderData }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, date")
      .eq("is_test_session", false)
      .gt("date", currentDate)
      .order("date", { ascending: true })
      .limit(1),
    supabase
      .from("sessions")
      .select("id, date")
      .eq("is_test_session", false)
      .lt("date", currentDate)
      .order("date", { ascending: false })
      .limit(1),
  ]);
  return {
    newer: newerData?.[0] ?? null,
    older: olderData?.[0] ?? null,
  };
}

export async function getPastSessionsThisSeason(seasonId: string, beforeDate: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, date, status")
    .eq("season_id", seasonId)
    .eq("is_test_session", false)
    .neq("session_type", "finals")
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(10);
  return data ?? [];
}

// Players currently present (checked in, not checked out), excluding deleted players
export async function getCheckedInPlayers(sessionId: string): Promise<CheckedInPlayer[]> {
  const supabase = await createClient();
  const [{ data }, { data: deletedData }] = await Promise.all([
    supabase
      .from("session_players")
      .select("player_id, checked_in_at, players(name, skill_level, user_id, is_admin)")
      .eq("session_id", sessionId)
      .is("checked_out_at", null)
      .order("checked_in_at"),
    supabase
      .from("players")
      .select("id")
      .not("deleted_at", "is", null),
  ]);

  const deletedIds = new Set((deletedData ?? []).map((p) => p.id));

  return (data ?? [])
    .filter((row) => !deletedIds.has(row.player_id))
    .map((row) => ({
      player_id: row.player_id,
      checked_in_at: row.checked_in_at,
      ...(row.players as unknown as { name: string; skill_level: number; user_id: string | null; is_admin: boolean }),
    }));
}

// Season stats: unique players who played ≥1 match, and total match count.
// For tally-only sessions (no match rows), approximates matches from session_tally wins
// (sum of wins / 2 = matches, since each match produces 2 wins).
export async function getSeasonStats(sessionIds: string[]): Promise<{ playerCount: number; matchCount: number }> {
  if (sessionIds.length === 0) return { playerCount: 0, matchCount: 0 };
  const supabase = await createClient();

  // All match records for these sessions
  const { data: matchRows } = await supabase
    .from("matches")
    .select("session_id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .in("session_id", sessionIds);

  const matches = matchRows ?? [];
  const sessionsWithMatches = new Set(matches.map((m) => m.session_id));

  // Unique players from match records
  const playerIds = new Set<string>();
  for (const m of matches) {
    playerIds.add(m.team1_player1_id);
    playerIds.add(m.team1_player2_id);
    playerIds.add(m.team2_player1_id);
    playerIds.add(m.team2_player2_id);
  }

  let matchCount = matches.length;

  // Tally-only sessions: approximate matches and add players from session_tally
  const tallyOnlyIds = sessionIds.filter((id) => !sessionsWithMatches.has(id));
  if (tallyOnlyIds.length > 0) {
    const { data: tallyRows } = await supabase
      .from("session_tally")
      .select("player_id, wins, losses")
      .in("session_id", tallyOnlyIds);

    let totalWins = 0;
    for (const t of (tallyRows ?? [])) {
      if ((t.wins ?? 0) + (t.losses ?? 0) > 0) playerIds.add(t.player_id);
      totalWins += t.wins ?? 0;
    }
    // Each match generates 2 wins (one per winning-team player)
    matchCount += Math.round(totalWins / 2);
  }

  return { playerCount: playerIds.size, matchCount };
}

// All presence records for a session (for admin players view)
export async function getSessionPresence(sessionId: string): Promise<SessionPresence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_players")
    .select("player_id, checked_in_at, checked_out_at")
    .eq("session_id", sessionId);
  return data ?? [];
}
