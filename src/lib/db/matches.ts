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

export interface PlayerSessionStat {
  date: string;
  wins: number;
  losses: number;
  win_pct: number;
}

export interface PlayerMatchRecord {
  id: string;
  date: string;
  won: boolean;
  partner: string;
  opponents: [string, string];
  my_score: number;
  opp_score: number;
}

export async function getPlayerSessionHistory(playerId: string): Promise<PlayerSessionStat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(`
      session_id, winning_team,
      team1_player1_id, team1_player2_id,
      team2_player1_id, team2_player2_id,
      sessions(date)
    `)
    .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`);

  if (!data) return [];

  const sessionMap = new Map<string, { date: string; wins: number; losses: number }>();

  for (const m of data) {
    const session = m.sessions as unknown as { date: string };
    const entry = sessionMap.get(m.session_id) ?? { date: session.date, wins: 0, losses: 0 };
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    if (won) entry.wins++; else entry.losses++;
    sessionMap.set(m.session_id, entry);
  }

  return Array.from(sessionMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, wins, losses }) => ({
      date,
      wins,
      losses,
      win_pct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    }));
}

export async function getPlayerMatches(
  playerId: string,
  page: number,
  pageSize = 20,
): Promise<{ matches: PlayerMatchRecord[]; total: number }> {
  const supabase = await createClient();
  const offset = (page - 1) * pageSize;

  const { data, count } = await supabase
    .from("matches")
    .select(`
      id, played_at, team1_score, team2_score, winning_team,
      team1_player1_id, team1_player2_id,
      team2_player1_id, team2_player2_id,
      sessions(date),
      t1p1:team1_player1_id(id, name),
      t1p2:team1_player2_id(id, name),
      t2p1:team2_player1_id(id, name),
      t2p2:team2_player2_id(id, name)
    `, { count: "exact" })
    .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
    .order("played_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const matches = (data ?? []).map((m) => {
    const t1p1 = m.t1p1 as unknown as { id: string; name: string };
    const t1p2 = m.t1p2 as unknown as { id: string; name: string };
    const t2p1 = m.t2p1 as unknown as { id: string; name: string };
    const t2p2 = m.t2p2 as unknown as { id: string; name: string };
    const session = m.sessions as unknown as { date: string };
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    const partner = onTeam1
      ? (m.team1_player1_id === playerId ? t1p2 : t1p1).name
      : (m.team2_player1_id === playerId ? t2p2 : t2p1).name;
    const opponents: [string, string] = onTeam1 ? [t2p1.name, t2p2.name] : [t1p1.name, t1p2.name];
    return {
      id: m.id,
      date: session.date,
      won,
      partner,
      opponents,
      my_score: onTeam1 ? m.team1_score : m.team2_score,
      opp_score: onTeam1 ? m.team2_score : m.team1_score,
    };
  });

  return { matches, total: count ?? 0 };
}

export async function getSeasonMatchCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
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
