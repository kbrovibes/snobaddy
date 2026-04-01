import { createClient } from "@/lib/supabase-server";

export interface Session {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  auto_generate_matches?: boolean;
  season: { id: string; name: string };
}

export interface SessionRow {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  season: { name: string };
}

export interface CheckedInPlayer {
  player_id: string;
  name: string;
  skill_level: number;
  checked_in_at: string;
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
    .select("id, date, status, seasons(id, name)")
    .eq("date", today)
    .maybeSingle();

  if (!data) return null;
  return { ...data, season: (data.seasons as unknown as Session["season"]) };
}

export async function getUpcomingSession(): Promise<Session | null> {
  const supabase = await createClient();
  const today = todayPacific();

  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, seasons(id, name)")
    .gt("date", today)
    .order("date")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { ...data, season: (data.seasons as unknown as Session["season"]) };
}

export async function getActiveSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, seasons(id, name)")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...data, season: (data.seasons as unknown as Session["season"]) };
}

export async function getAllSessions(): Promise<SessionRow[]> {
  const supabase = await createClient();
  const today = todayPacific();

  // Find the next session on or after today — that's our upper bound
  const { data: next } = await supabase
    .from("sessions")
    .select("date")
    .gte("date", today)
    .order("date")
    .limit(1)
    .maybeSingle();

  // If no upcoming session, cap at today (shows all past sessions)
  const cutoff = next?.date ?? today;

  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, seasons(name)")
    .lte("date", cutoff)
    .order("date", { ascending: false });
  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status as SessionRow["status"],
    season: (row.seasons as unknown as { name: string }),
  }));
}

export async function getSessionById(id: string): Promise<Session | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, date, status, auto_generate_matches, seasons(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as typeof data & { auto_generate_matches?: boolean };
  return {
    ...data,
    auto_generate_matches: row.auto_generate_matches ?? true,
    season: (data.seasons as unknown as Session["season"]),
  };
}

export async function getPastSessionsThisSeason(seasonId: string, beforeDate: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, date, status")
    .eq("season_id", seasonId)
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(10);
  return data ?? [];
}

// Players currently present (checked in, not checked out)
export async function getCheckedInPlayers(sessionId: string): Promise<CheckedInPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_players")
    .select("player_id, checked_in_at, players(name, skill_level)")
    .eq("session_id", sessionId)
    .is("checked_out_at", null)
    .order("checked_in_at");

  return (data ?? []).map((row) => ({
    player_id: row.player_id,
    checked_in_at: row.checked_in_at,
    ...(row.players as unknown as { name: string; skill_level: number }),
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
