import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";

export interface PlayerStats {
  id: string;
  name: string;
  email: string;
  skill_level: number;
  is_admin: boolean;
  matches_played: number;
  wins: number;
  losses: number;
}

const ADMIN_EMAILS = [
  "karthik220290@gmail.com",
  "k4rthikr@gmail.com",
  "swathyee86@gmail.com",
  "kiran10a@gmail.com",
  "sekhar.durga@gmail.com",
];

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email);
}

export async function getAllPlayers(): Promise<PlayerStats[]> {
  const supabase = await createClient();
  
  // 1. Get all players who completed onboarding
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, email, skill_level, is_admin")
    .eq("onboarding_complete", true)
    .order("name");

  if (error) throw new Error(error.message);
  if (!players) return [];

  // 2. Get all matches for aggregation
  // In a larger app, we would do this via a database view or RPC, 
  // but for MVP scale, in-memory aggregation is fast and simple.
  const { data: matches } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team");

  const statsMap = new Map<string, { wins: number; losses: number; played: number }>();
  
  for (const m of matches ?? []) {
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

export async function getPlayerById(id: string): Promise<{ id: string; name: string; skill_level: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, name, skill_level")
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
