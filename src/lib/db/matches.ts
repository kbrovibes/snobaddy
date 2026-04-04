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

export interface PlayerMatchBySession {
  session_id: string;
  date: string;
  matches: PlayerMatchRecord[];
}

export async function getPlayerMatchesBySession(playerId: string): Promise<PlayerMatchBySession[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select(`
      id, played_at, session_id, team1_score, team2_score, winning_team,
      team1_player1_id, team1_player2_id,
      team2_player1_id, team2_player2_id,
      sessions(date),
      t1p1:team1_player1_id(id, name),
      t1p2:team1_player2_id(id, name),
      t2p1:team2_player1_id(id, name),
      t2p2:team2_player2_id(id, name)
    `)
    .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
    .order("played_at", { ascending: true });

  if (!data) return [];

  const sessionMap = new Map<string, { date: string; matches: PlayerMatchRecord[] }>();

  for (const m of data) {
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

    const record: PlayerMatchRecord = {
      id: m.id,
      date: session.date,
      won,
      partner,
      opponents,
      my_score: onTeam1 ? m.team1_score : m.team2_score,
      opp_score: onTeam1 ? m.team2_score : m.team1_score,
    };

    const entry = sessionMap.get(m.session_id) ?? { date: session.date, matches: [] };
    entry.matches.push(record);
    sessionMap.set(m.session_id, entry);
  }

  return Array.from(sessionMap.entries())
    .map(([session_id, { date, matches }]) => ({ session_id, date, matches }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface SessionHighlights {
  totalMatches: number;
  sultan: { names: string[]; wins: number } | null;
  ironShuttle: { names: string[]; matches: number } | null;
  untouchable: { names: string[]; winPct: number; matches: number } | null;
  cannon: { names: string[]; points: number } | null;
  noMercy: { team: [string, string]; margin: number; score: string } | null;
}

export async function getSessionHighlights(sessionId: string): Promise<SessionHighlights> {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      team1_player1_id, team1_player2_id,
      team2_player1_id, team2_player2_id,
      winning_team, team1_score, team2_score,
      t1p1:team1_player1_id(name),
      t1p2:team1_player2_id(name),
      t2p1:team2_player1_id(name),
      t2p2:team2_player2_id(name)
    `)
    .eq("session_id", sessionId);

  const rows = matches ?? [];
  const totalMatches = rows.length;

  if (totalMatches < 3) {
    return { totalMatches, sultan: null, ironShuttle: null, untouchable: null, cannon: null, noMercy: null };
  }

  // Per-player stats
  const playerWins = new Map<string, number>();
  const playerMatches = new Map<string, number>();
  const playerPoints = new Map<string, number>();
  const playerNames = new Map<string, string>();

  // No Mercy: biggest margin
  let maxMargin = -1;
  let noMercyTeam: [string, string] | null = null;
  let noMercyScore = "";

  for (const m of rows) {
    const t1p1 = m.t1p1 as unknown as { name: string };
    const t1p2 = m.t1p2 as unknown as { name: string };
    const t2p1 = m.t2p1 as unknown as { name: string };
    const t2p2 = m.t2p2 as unknown as { name: string };

    const team1Ids = [m.team1_player1_id, m.team1_player2_id];
    const team2Ids = [m.team2_player1_id, m.team2_player2_id];
    const team1Names: [string, string] = [t1p1.name, t1p2.name];
    const team2Names: [string, string] = [t2p1.name, t2p2.name];

    playerNames.set(m.team1_player1_id, t1p1.name);
    playerNames.set(m.team1_player2_id, t1p2.name);
    playerNames.set(m.team2_player1_id, t2p1.name);
    playerNames.set(m.team2_player2_id, t2p2.name);

    const winners = m.winning_team === 1 ? team1Ids : team2Ids;
    const losers = m.winning_team === 1 ? team2Ids : team1Ids;

    for (const pid of winners) {
      playerWins.set(pid, (playerWins.get(pid) ?? 0) + 1);
    }
    for (const pid of [...winners, ...losers]) {
      playerMatches.set(pid, (playerMatches.get(pid) ?? 0) + 1);
    }

    // Points per player = their team's score in this match
    for (const pid of team1Ids) {
      playerPoints.set(pid, (playerPoints.get(pid) ?? 0) + m.team1_score);
    }
    for (const pid of team2Ids) {
      playerPoints.set(pid, (playerPoints.get(pid) ?? 0) + m.team2_score);
    }

    // No Mercy margin
    const margin = Math.abs(m.team1_score - m.team2_score);
    if (margin > maxMargin) {
      maxMargin = margin;
      const winnerTeamNames = m.winning_team === 1 ? team1Names : team2Names;
      noMercyTeam = winnerTeamNames;
      noMercyScore = `${Math.max(m.team1_score, m.team2_score)}–${Math.min(m.team1_score, m.team2_score)}`;
    }
  }

  // The Sultan: most wins — all tied players alphabetically
  const maxWins = Math.max(...Array.from(playerWins.values()));
  const sultanNames = Array.from(playerWins.entries())
    .filter(([, w]) => w === maxWins)
    .map(([pid]) => playerNames.get(pid) ?? "")
    .sort();

  // Iron Shuttle: most matches played — all tied players alphabetically
  const maxMatchesVal = Math.max(...Array.from(playerMatches.values()));
  const ironNames = Array.from(playerMatches.entries())
    .filter(([, m]) => m === maxMatchesVal)
    .map(([pid]) => playerNames.get(pid) ?? "")
    .sort();

  // The Untouchable: best win rate (min 3 matches) — all tied players alphabetically
  const qualifiedRates = Array.from(playerMatches.entries())
    .filter(([, m]) => m >= 3)
    .map(([pid, m]) => ({ pid, m, pct: Math.round(((playerWins.get(pid) ?? 0) / m) * 100) }));
  const topPct = qualifiedRates.length ? Math.max(...qualifiedRates.map(e => e.pct)) : null;
  const topEntry = qualifiedRates.find(e => e.pct === topPct) ?? null;
  const untouchableNames = topPct !== null
    ? qualifiedRates.filter(e => e.pct === topPct).map(e => playerNames.get(e.pid) ?? "").sort()
    : [];

  // The Cannon: most points scored — all tied players alphabetically
  const maxPoints = Math.max(...Array.from(playerPoints.values()));
  const cannonNames = Array.from(playerPoints.entries())
    .filter(([, pts]) => pts === maxPoints)
    .map(([pid]) => playerNames.get(pid) ?? "")
    .sort();

  return {
    totalMatches,
    sultan: sultanNames.length ? { names: sultanNames, wins: maxWins } : null,
    ironShuttle: ironNames.length ? { names: ironNames, matches: maxMatchesVal } : null,
    untouchable: untouchableNames.length
      ? { names: untouchableNames, winPct: topPct!, matches: topEntry!.m }
      : null,
    cannon: cannonNames.length ? { names: cannonNames, points: maxPoints } : null,
    noMercy: noMercyTeam ? { team: noMercyTeam, margin: maxMargin, score: noMercyScore } : null,
  };
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

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team,
      t1p1:team1_player1_id(name, skill_level),
      t1p2:team1_player2_id(name, skill_level),
      t2p1:team2_player1_id(name, skill_level),
      t2p2:team2_player2_id(name, skill_level)
    `)
    .eq("session_id", sessionId);

  const stats = new Map<string, PlayerSessionStats>();

  function ensurePlayer(id: string, player: { name: string; skill_level: number }) {
    if (!stats.has(id)) {
      stats.set(id, { player_id: id, name: player.name, skill_level: player.skill_level, wins: 0, losses: 0, matches_played: 0 });
    }
  }

  for (const m of matches ?? []) {
    const t1p1 = m.t1p1 as unknown as { name: string; skill_level: number };
    const t1p2 = m.t1p2 as unknown as { name: string; skill_level: number };
    const t2p1 = m.t2p1 as unknown as { name: string; skill_level: number };
    const t2p2 = m.t2p2 as unknown as { name: string; skill_level: number };

    ensurePlayer(m.team1_player1_id, t1p1);
    ensurePlayer(m.team1_player2_id, t1p2);
    ensurePlayer(m.team2_player1_id, t2p1);
    ensurePlayer(m.team2_player2_id, t2p2);

    const team1 = [m.team1_player1_id, m.team1_player2_id];
    const team2 = [m.team2_player1_id, m.team2_player2_id];
    const winners = m.winning_team === 1 ? team1 : team2;
    const losers = m.winning_team === 1 ? team2 : team1;

    for (const pid of winners) {
      const s = stats.get(pid)!;
      s.wins++; s.matches_played++;
    }
    for (const pid of losers) {
      const s = stats.get(pid)!;
      s.losses++; s.matches_played++;
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    const aPct = a.matches_played ? a.wins / a.matches_played : 0;
    const bPct = b.matches_played ? b.wins / b.matches_played : 0;
    if (bPct !== aPct) return bPct - aPct;
    return b.matches_played - a.matches_played;
  });
}
