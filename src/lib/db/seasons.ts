import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export type SeasonStatus = "active" | "upcoming" | "completed";

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  stats_lock_date: string | null;
}

export interface SeasonSession {
  id: string;
  date: string;
  status: "pending" | "active" | "completed";
  stats_lock_date: string | null;
  match_count: number;
}

export interface SeasonWithStats extends Season {
  session_count: number;
  player_count: number;
  match_count: number;
  finals_status: string | null;
}

/** Returns all seasons ordered by start_date DESC. */
export async function getAllSeasons(): Promise<SeasonWithStats[]> {
  const supabase = await createClient();

  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, status, stats_lock_date")
    .order("start_date", { ascending: false });

  if (!seasons || seasons.length === 0) return [];

  const result: SeasonWithStats[] = [];

  for (const s of seasons) {
    // Count non-finals, non-test sessions
    const { count: sessionCount } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("season_id", s.id)
      .eq("is_test_session", false)
      .neq("session_type", "finals");

    // Count matches via sessions in this season
    const { count: matchCount } = await supabase
      .from("matches")
      .select("id, sessions!inner(season_id)", { count: "exact", head: true })
      .eq("sessions.season_id", s.id);

    // Count unique players from matches
    const { data: matchRows } = await supabase
      .from("matches")
      .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, sessions!inner(season_id)")
      .eq("sessions.season_id", s.id);

    const playerIds = new Set<string>();
    for (const m of matchRows ?? []) {
      playerIds.add(m.team1_player1_id);
      playerIds.add(m.team1_player2_id);
      playerIds.add(m.team2_player1_id);
      playerIds.add(m.team2_player2_id);
    }

    // Check finals status
    const { data: finals } = await supabase
      .from("finals_events")
      .select("status")
      .eq("season_id", s.id)
      .maybeSingle();

    result.push({
      id: s.id,
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status as SeasonStatus,
      stats_lock_date: (s as unknown as { stats_lock_date?: string | null }).stats_lock_date ?? null,
      session_count: sessionCount ?? 0,
      player_count: playerIds.size,
      match_count: matchCount ?? 0,
      finals_status: finals?.status ?? null,
    });
  }

  return result;
}

/** Returns the single active season, or null. */
export async function getActiveSeason(): Promise<Season | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, status, stats_lock_date")
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return data as Season;
}

/** Create a new season. Auto-sets status to 'active' if none exists, else 'upcoming'. */
export async function createSeason(opts: {
  name: string;
  start_date: string;
  end_date: string;
}): Promise<string> {
  // Check if there's already an active season
  const { data: active } = await adminDb
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  const status: SeasonStatus = active ? "upcoming" : "active";

  const { data, error } = await adminDb
    .from("seasons")
    .insert({
      name: opts.name,
      start_date: opts.start_date,
      end_date: opts.end_date,
      status,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/** Change season status. Validates transitions. */
export async function updateSeasonStatus(
  seasonId: string,
  newStatus: SeasonStatus
): Promise<void> {
  if (newStatus === "active") {
    // Ensure no other season is active
    const { data: active } = await adminDb
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .neq("id", seasonId)
      .maybeSingle();
    if (active) throw new Error("Another season is already active. Close it first.");
  }

  if (newStatus === "completed") {
    // Ensure no active sessions in this season
    const { data: activeSessions } = await adminDb
      .from("sessions")
      .select("id")
      .eq("season_id", seasonId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (activeSessions) throw new Error("Close all active sessions before closing the season.");
  }

  const { error } = await adminDb
    .from("seasons")
    .update({ status: newStatus })
    .eq("id", seasonId);
  if (error) throw new Error(error.message);
}
