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
  has_newsletter: boolean;
}

/** Returns all seasons ordered by start_date DESC. */
export async function getAllSeasons(): Promise<SeasonWithStats[]> {
  const supabase = await createClient();

  const [
    { data: seasons },
    { data: allSessions },
    { data: allMatchRows },
    { data: allFinals },
    { data: newsletterRows },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, start_date, end_date, status, stats_lock_date")
      .order("start_date", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, season_id, is_test_session, session_type"),
    supabase
      .from("matches")
      .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, session_id, sessions!inner(season_id)"),
    supabase
      .from("finals_events")
      .select("season_id, status"),
    supabase
      .from("season_newsletters")
      .select("season_id"),
  ]);

  const newsletterSeasonIds = new Set<string>((newsletterRows ?? []).map((r) => (r as { season_id: string }).season_id));

  if (!seasons || seasons.length === 0) return [];

  // Build lookup: season_id -> session_count (non-test, non-finals)
  const sessionCountBySeason = new Map<string, number>();
  // Build lookup: session_id -> season_id (for match grouping)
  const seasonBySession = new Map<string, string>();
  for (const sess of allSessions ?? []) {
    seasonBySession.set(sess.id, sess.season_id);
    if (!sess.is_test_session && sess.session_type !== "finals") {
      sessionCountBySeason.set(
        sess.season_id,
        (sessionCountBySeason.get(sess.season_id) ?? 0) + 1
      );
    }
  }

  // Build lookup: season_id -> { matchCount, playerIds }
  interface SeasonStats { matchCount: number; playerIds: Set<string> }
  const statsBySeason = new Map<string, SeasonStats>();
  for (const m of allMatchRows ?? []) {
    const seasonId = (m.sessions as unknown as { season_id: string }).season_id;
    if (!seasonId) continue;
    if (!statsBySeason.has(seasonId)) {
      statsBySeason.set(seasonId, { matchCount: 0, playerIds: new Set() });
    }
    const stats = statsBySeason.get(seasonId)!;
    stats.matchCount += 1;
    stats.playerIds.add(m.team1_player1_id);
    stats.playerIds.add(m.team1_player2_id);
    stats.playerIds.add(m.team2_player1_id);
    stats.playerIds.add(m.team2_player2_id);
  }

  // Build lookup: season_id -> finals status
  const finalsBySeason = new Map<string, string>();
  for (const f of allFinals ?? []) {
    finalsBySeason.set(f.season_id, f.status);
  }

  return seasons.map((s) => {
    const stats = statsBySeason.get(s.id);
    return {
      id: s.id,
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status as SeasonStatus,
      stats_lock_date: (s as unknown as { stats_lock_date?: string | null }).stats_lock_date ?? null,
      session_count: sessionCountBySeason.get(s.id) ?? 0,
      player_count: stats?.playerIds.size ?? 0,
      match_count: stats?.matchCount ?? 0,
      finals_status: finalsBySeason.get(s.id) ?? null,
      has_newsletter: newsletterSeasonIds.has(s.id),
    };
  });
}

/** Returns a single season by ID, or null. */
export async function getSeasonById(id: string): Promise<Season | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, status, stats_lock_date")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return data as Season;
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
