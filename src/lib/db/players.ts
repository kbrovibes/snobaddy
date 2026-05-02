import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";

export interface PlayerStats {
  id: string;
  name: string;
  email: string;
  skill_level: number;
  is_admin: boolean;
  user_id: string | null;
  matches_played: number;
  wins: number;
  losses: number;
}


export async function getActivePlayers(
  options?: { includeTestSessions?: boolean; seasonId?: string }
): Promise<PlayerStats[]> {
  const supabase = await createClient();
  const includeTest = options?.includeTestSessions ?? false;
  const seasonId = options?.seasonId;

  let matchesQuery = includeTest
    ? supabase
        .from("matches")
        .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team, sessions!inner(is_test_session, season_id)")
        .eq("match_type", "regular")
    : supabase
        .from("matches")
        .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team, sessions!inner(is_test_session, season_id)")
        .eq("sessions.is_test_session", false)
        .eq("match_type", "regular");

  if (seasonId) {
    matchesQuery = matchesQuery.eq("sessions.season_id", seasonId);
  }

  let talliesQuery = includeTest
    ? supabase.from("session_tally").select("player_id, wins, losses, sessions!inner(is_test_session, season_id)")
    : supabase
        .from("session_tally")
        .select("player_id, wins, losses, sessions!inner(is_test_session, season_id)")
        .eq("sessions.is_test_session", false);

  if (seasonId) {
    talliesQuery = talliesQuery.eq("sessions.season_id", seasonId);
  }

  const [
    { data: players, error },
    { data: matches },
    { data: deletedData },
    { data: tallies },
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, email, skill_level, is_admin, user_id")
      .eq("onboarding_complete", true)
      .is("deleted_at", null)
      .order("name"),
    matchesQuery,
    supabase
      .from("players")
      .select("id")
      .not("deleted_at", "is", null),
    talliesQuery,
  ]);

  if (error) throw new Error(error.message);
  if (!players) return [];

  const deletedIds = new Set((deletedData ?? []).map((p) => p.id));

  const statsMap = new Map<string, { wins: number; losses: number; played: number }>();

  for (const m of matches ?? []) {
    // Skip any match involving a deleted player
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

    for (const pid of winners) {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, played: 0 };
      s.wins++;
      s.played++;
      statsMap.set(pid, s);
    }
    for (const pid of losers) {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, played: 0 };
      s.losses++;
      s.played++;
      statsMap.set(pid, s);
    }
  }

  // Add tally-session stats (sessions where no individual matches were recorded)
  for (const t of tallies ?? []) {
    if (t.wins === 0 && t.losses === 0) continue;
    const s = statsMap.get(t.player_id) ?? { wins: 0, losses: 0, played: 0 };
    s.wins += t.wins;
    s.losses += t.losses;
    s.played += t.wins + t.losses;
    statsMap.set(t.player_id, s);
  }

  return players.map((p) => {
    const s = statsMap.get(p.id) ?? { wins: 0, losses: 0, played: 0 };
    return {
      ...p,
      matches_played: s.played,
      wins: s.wins,
      losses: s.losses,
    };
  });
}

export async function getActivePlayerList(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, name")
    .eq("onboarding_complete", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

/** @deprecated Use getActivePlayers() instead */
export const getAllPlayers = getActivePlayers;

export interface DeletedPlayer {
  id: string;
  name: string;
  skill_level: number;
}

export async function getDeletedPlayers(): Promise<DeletedPlayer[]> {
  const { data, error } = await serviceClient
    .from("players")
    .select("id, name, skill_level")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await serviceClient
    .from("players")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restorePlayer(id: string): Promise<void> {
  const { error } = await serviceClient
    .from("players")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Returns the subset of playerIds who pinged the server within the last 5
 * minutes (i.e. have the app open). Reads players.last_seen_at which is
 * updated by POST /api/ping on every session page load.
 * Requires: ALTER TABLE players ADD COLUMN last_seen_at TIMESTAMPTZ;
 */
export async function getOnlinePlayerIds(playerIds: string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();

  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data } = await serviceClient
    .from("players")
    .select("id")
    .in("id", playerIds)
    .gt("last_seen_at", fiveMinsAgo);

  return new Set((data ?? []).map((r) => r.id));
}

export async function getPlayerById(id: string): Promise<{ id: string; name: string; skill_level: number; user_id: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, name, skill_level, user_id")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function updateSkillLevel(playerId: string, skillLevel: number) {
  const { error } = await serviceClient
    .from("players")
    .update({ skill_level: skillLevel })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

export async function updatePlayerName(playerId: string, name: string) {
  const { error } = await serviceClient
    .from("players")
    .update({ name: name.trim() })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

export interface PlayerPoemContext {
  wins: number;
  losses: number;
  recentSessions: Array<{ date: string; wins: number; losses: number }>;
  topPartner: string | null;
  onlyTestSessions: boolean; // true = player has real data only in test sessions
  gender: "male" | "female";
}

export async function getPlayerPoemContext(playerId: string): Promise<PlayerPoemContext> {
  // Fetch individual matches (non-test + test, so we can detect test-only players)
  const [{ data: playerRow }, { data: allMatchData }, { data: realMatchData }, { data: tallyData }] = await Promise.all([
    serviceClient.from("players").select("gender").eq("id", playerId).maybeSingle(),
    serviceClient
      .from("matches")
      .select("session_id, sessions(is_test_session)")
      .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`),
    serviceClient
      .from("matches")
      .select(`
        winning_team, session_id,
        team1_player1_id, team1_player2_id,
        team2_player1_id, team2_player2_id,
        sessions!inner(date, is_test_session),
        t1p1:team1_player1_id(name),
        t1p2:team1_player2_id(name),
        t2p1:team2_player1_id(name),
        t2p2:team2_player2_id(name)
      `)
      .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
      .eq("sessions.is_test_session", false),
    serviceClient
      .from("session_tally")
      .select("session_id, wins, losses, sessions(date, is_test_session)")
      .eq("player_id", playerId),
  ]);

  // Detect test-only: has any matches/tallies but all are from test sessions
  const hasAnyData = (allMatchData ?? []).length > 0 || (tallyData ?? []).length > 0;
  const hasRealMatchData = (realMatchData ?? []).length > 0;
  const hasRealTallyData = (tallyData ?? []).some(
    (t) => !(t.sessions as unknown as { is_test_session: boolean })?.is_test_session
  );
  const onlyTestSessions = hasAnyData && !hasRealMatchData && !hasRealTallyData;

  let wins = 0;
  let losses = 0;
  const partnerCount = new Map<string, number>();
  const sessionMap = new Map<string, { date: string; wins: number; losses: number }>();

  // Individual match records (non-test only)
  for (const m of realMatchData ?? []) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    if (won) wins++; else losses++;

    const t1p1 = (m.t1p1 as unknown as { name: string }).name;
    const t1p2 = (m.t1p2 as unknown as { name: string }).name;
    const t2p1 = (m.t2p1 as unknown as { name: string }).name;
    const t2p2 = (m.t2p2 as unknown as { name: string }).name;
    const partner = onTeam1
      ? (m.team1_player1_id === playerId ? t1p2 : t1p1)
      : (m.team2_player1_id === playerId ? t2p2 : t2p1);
    partnerCount.set(partner, (partnerCount.get(partner) ?? 0) + 1);

    const session = m.sessions as unknown as { date: string };
    const entry = sessionMap.get(m.session_id) ?? { date: session.date, wins: 0, losses: 0 };
    if (won) entry.wins++; else entry.losses++;
    sessionMap.set(m.session_id, entry);
  }

  // Tally records (non-test only) — add sessions not already covered by individual matches
  for (const t of tallyData ?? []) {
    const session = t.sessions as unknown as { date: string; is_test_session: boolean };
    if (session.is_test_session) continue;
    wins += t.wins;
    losses += t.losses;
    if (!sessionMap.has(t.session_id)) {
      sessionMap.set(t.session_id, { date: session.date, wins: t.wins, losses: t.losses });
    }
  }

  const recentSessions = Array.from(sessionMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const topPartner = partnerCount.size > 0
    ? Array.from(partnerCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const gender = (playerRow?.gender === "female" ? "female" : "male") as "male" | "female";
  return { wins, losses, recentSessions, topPartner, onlyTestSessions, gender };
}

export async function getPlayerPoem(
  playerId: string
): Promise<{ poem: string; matches_at_generation: number; created_at: string } | null> {
  const { data } = await serviceClient
    .from("player_poems")
    .select("poem, matches_at_generation, created_at")
    .eq("player_id", playerId)
    .maybeSingle();
  return data ?? null;
}

export async function upsertPlayerPoem(
  playerId: string,
  poem: string,
  matchCount: number
): Promise<void> {
  const { error } = await serviceClient
    .from("player_poems")
    .upsert(
      { player_id: playerId, poem, matches_at_generation: matchCount, created_at: new Date().toISOString() },
      { onConflict: "player_id" }
    );
  if (error) throw new Error(error.message);
}
