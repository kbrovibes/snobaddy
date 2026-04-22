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
}

export interface SessionRow {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  is_test_session: boolean;
  season: { name: string };
  match_count: number;
  tally_count: number;
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
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, season: (data.seasons as unknown as Session["season"]) };
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
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, season: (data.seasons as unknown as Session["season"]) };
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
  return { ...data, simple_score_tracking: true, tally_photo_path: null, whiteboard_mode: true, season: (data.seasons as unknown as Session["season"]) };
}

export async function getAllSessions(): Promise<SessionRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, is_test_session, session_type, seasons(name), matches(count), session_tally(count)")
    .order("date", { ascending: false });
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
      season: (fallback.seasons as unknown as Session["season"]),
    };
  }

  const row = data as typeof data & { auto_generate_matches?: boolean; simple_score_tracking?: boolean; is_test_session?: boolean; tally_photo_path?: string | null; session_type?: string; finals_event_id?: string | null; whiteboard_mode?: boolean };
  return {
    ...data,
    auto_generate_matches: row.auto_generate_matches ?? true,
    simple_score_tracking: row.simple_score_tracking ?? true,
    is_test_session: row.is_test_session ?? false,
    tally_photo_path: row.tally_photo_path ?? null,
    session_type: (row.session_type as "regular" | "finals" | undefined) ?? "regular",
    finals_event_id: row.finals_event_id ?? null,
    whiteboard_mode: row.whiteboard_mode ?? true,
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

// All presence records for a session (for admin players view)
export async function getSessionPresence(sessionId: string): Promise<SessionPresence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_players")
    .select("player_id, checked_in_at, checked_out_at")
    .eq("session_id", sessionId);
  return data ?? [];
}
