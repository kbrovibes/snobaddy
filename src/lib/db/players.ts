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

const ADMIN_EMAILS = ["karthik220290@gmail.com", "k4rthikr@gmail.com"];

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
 * Returns the subset of playerIds whose linked auth user signed in within the
 * last 5 minutes. Players with no user_id (manually added) are never included.
 * Approximate — good enough for a "who's on their phone right now" green dot.
 */
export async function getOnlinePlayerIds(playerIds: string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();

  const { data: rows } = await serviceClient
    .from("players")
    .select("id, user_id")
    .in("id", playerIds)
    .not("user_id", "is", null);

  if (!rows || rows.length === 0) return new Set();

  const userIdToPlayerId = new Map<string, string>();
  for (const row of rows) {
    if (row.user_id) userIdToPlayerId.set(row.user_id, row.id);
  }

  const { data: authData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const online = new Set<string>();
  for (const u of authData?.users ?? []) {
    if (
      userIdToPlayerId.has(u.id) &&
      u.last_sign_in_at &&
      u.last_sign_in_at > fiveMinsAgo
    ) {
      online.add(userIdToPlayerId.get(u.id)!);
    }
  }
  return online;
}

export async function updateSkillLevel(playerId: string, skillLevel: number) {
  const { error } = await serviceClient
    .from("players")
    .update({ skill_level: skillLevel })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}
