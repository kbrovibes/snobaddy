import { supabase as serviceClient } from "@/lib/supabase";
import { getAllUbrRatings } from "@/lib/db/ubr";

export interface GlobalPlayerStats {
  id: string;
  name: string;
  matches_played: number;
  wins: number;
  losses: number;
  ubr_rating: number | null;
}

export interface GlobalLeaderboardPayload {
  players: GlobalPlayerStats[];
  computed_at: string;
}

/** Compute global leaderboard across all non-test, non-finals sessions. */
export async function computeGlobalLeaderboard(): Promise<GlobalLeaderboardPayload> {
  const [
    { data: players },
    { data: matches },
    { data: tallies },
    ubrMap,
  ] = await Promise.all([
    serviceClient
      .from("players")
      .select("id, name")
      .eq("onboarding_complete", true)
      .is("deleted_at", null),
    serviceClient
      .from("matches")
      .select("session_id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team, sessions!inner(is_test_session, session_type)")
      .eq("sessions.is_test_session", false)
      .neq("sessions.session_type", "finals")
      .eq("match_type", "regular"),
    serviceClient
      .from("session_tally")
      .select("player_id, wins, losses, sessions!inner(is_test_session, session_type)")
      .eq("sessions.is_test_session", false)
      .neq("sessions.session_type", "finals"),
    getAllUbrRatings(),
  ]);

  const deletedSet = new Set<string>(); // players are already filtered above

  const statsMap = new Map<string, { wins: number; losses: number; played: number }>();

  for (const m of matches ?? []) {
    const p1 = [m.team1_player1_id, m.team1_player2_id];
    const p2 = [m.team2_player1_id, m.team2_player2_id];
    const winners = m.winning_team === 1 ? p1 : p2;
    const losers  = m.winning_team === 1 ? p2 : p1;
    for (const pid of winners) {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, played: 0 };
      s.wins++; s.played++;
      statsMap.set(pid, s);
    }
    for (const pid of losers) {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, played: 0 };
      s.losses++; s.played++;
      statsMap.set(pid, s);
    }
  }

  for (const t of tallies ?? []) {
    if (t.wins === 0 && t.losses === 0) continue;
    const s = statsMap.get(t.player_id) ?? { wins: 0, losses: 0, played: 0 };
    s.wins    += t.wins;
    s.losses  += t.losses;
    s.played  += t.wins + t.losses;
    statsMap.set(t.player_id, s);
  }

  const result: GlobalPlayerStats[] = (players ?? []).map((p) => {
    const s = statsMap.get(p.id) ?? { wins: 0, losses: 0, played: 0 };
    const ubr = ubrMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      matches_played: s.played,
      wins: s.wins,
      losses: s.losses,
      ubr_rating: ubr ? ubr.rating : null,
    };
  });

  return { players: result, computed_at: new Date().toISOString() };
}

/** Write computed payload to the singleton cache row. */
export async function setGlobalLeaderboardCache(payload: GlobalLeaderboardPayload): Promise<void> {
  await serviceClient
    .from("global_leaderboard_cache")
    .upsert({ id: 1, payload, computed_at: payload.computed_at }, { onConflict: "id" });
}

/** Read cached payload, or null if not yet computed. */
export async function getGlobalLeaderboardCache(): Promise<GlobalLeaderboardPayload | null> {
  const { data } = await serviceClient
    .from("global_leaderboard_cache")
    .select("payload, computed_at")
    .eq("id", 1)
    .maybeSingle();
  return (data?.payload as GlobalLeaderboardPayload) ?? null;
}
