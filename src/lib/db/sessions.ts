import { createClient } from "@/lib/supabase-server";

export interface Session {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  season: { id: string; name: string };
}

export interface CheckedInPlayer {
  player_id: string;
  name: string;
  skill_level: number;
  checked_in_at: string;
}

export async function getTodaySession(): Promise<Session | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

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
  const today = new Date().toISOString().split("T")[0];

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

export async function getCheckedInPlayers(sessionId: string): Promise<CheckedInPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_players")
    .select("player_id, checked_in_at, players(name, skill_level)")
    .eq("session_id", sessionId)
    .order("checked_in_at");

  return (data ?? []).map((row) => ({
    player_id: row.player_id,
    checked_in_at: row.checked_in_at,
    ...(row.players as unknown as { name: string; skill_level: number }),
  }));
}
