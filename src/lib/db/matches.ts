import { createClient } from "@/lib/supabase-server";

export interface MatchRecord {
  id: string;
  played_at: string;
  team1_score: number;
  team2_score: number;
  winning_team: 1 | 2;
  team1: [string, string]; // player names
  team2: [string, string];
}

export interface PlayerSessionStats {
  player_id: string;
  name: string;
  skill_level: number;
  wins: number;
  losses: number;
  matches_played: number;
}

export async function getSessionMatches(sessionId: string): Promise<MatchRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(`
      id, played_at, team1_score, team2_score, winning_team,
      t1p1:team1_player1_id(name),
      t1p2:team1_player2_id(name),
      t2p1:team2_player1_id(name),
      t2p2:team2_player2_id(name)
    `)
    .eq("session_id", sessionId)
    .order("played_at", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    played_at: m.played_at,
    team1_score: m.team1_score,
    team2_score: m.team2_score,
    winning_team: m.winning_team as 1 | 2,
    team1: [
      (m.t1p1 as unknown as { name: string }).name,
      (m.t1p2 as unknown as { name: string }).name,
    ] as [string, string],
    team2: [
      (m.t2p1 as unknown as { name: string }).name,
      (m.t2p2 as unknown as { name: string }).name,
    ] as [string, string],
  }));
}

export async function getSessionScoreboard(sessionId: string): Promise<PlayerSessionStats[]> {
  const supabase = await createClient();

  // Get all checked-in players for this session
  const { data: checkedIn } = await supabase
    .from("session_players")
    .select("player_id, players(name, skill_level)")
    .eq("session_id", sessionId)
    .is("checked_out_at", null);

  const { data: matches } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team")
    .eq("session_id", sessionId);

  const stats = new Map<string, PlayerSessionStats>();

  for (const row of checkedIn ?? []) {
    const p = row.players as unknown as { name: string; skill_level: number };
    stats.set(row.player_id, {
      player_id: row.player_id,
      name: p.name,
      skill_level: p.skill_level,
      wins: 0,
      losses: 0,
      matches_played: 0,
    });
  }

  for (const m of matches ?? []) {
    const team1 = [m.team1_player1_id, m.team1_player2_id];
    const team2 = [m.team2_player1_id, m.team2_player2_id];
    const winners = m.winning_team === 1 ? team1 : team2;
    const losers = m.winning_team === 1 ? team2 : team1;

    for (const pid of winners) {
      const s = stats.get(pid);
      if (s) { s.wins++; s.matches_played++; }
    }
    for (const pid of losers) {
      const s = stats.get(pid);
      if (s) { s.losses++; s.matches_played++; }
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    const aPct = a.matches_played ? a.wins / a.matches_played : 0;
    const bPct = b.matches_played ? b.wins / b.matches_played : 0;
    if (bPct !== aPct) return bPct - aPct;
    return b.matches_played - a.matches_played;
  });
}
