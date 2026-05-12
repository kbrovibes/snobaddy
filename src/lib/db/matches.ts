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
  points: number;
  user_id: string | null;
  is_admin: boolean;
}

async function getDeletedPlayerIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Set<string>> {
  const { data } = await supabase
    .from("players")
    .select("id")
    .not("deleted_at", "is", null);
  return new Set((data ?? []).map((p: { id: string }) => p.id));
}

function hasDeletedPlayer(
  m: { team1_player1_id: string; team1_player2_id: string; team2_player1_id: string; team2_player2_id: string },
  deletedIds: Set<string>
): boolean {
  return (
    deletedIds.has(m.team1_player1_id) ||
    deletedIds.has(m.team1_player2_id) ||
    deletedIds.has(m.team2_player1_id) ||
    deletedIds.has(m.team2_player2_id)
  );
}

export async function getSessionMatches(sessionId: string): Promise<MatchRecord[]> {
  const supabase = await createClient();
  const [{ data }, deletedIds] = await Promise.all([
    supabase
      .from("matches")
      .select(`
        id, played_at, team1_score, team2_score, winning_team,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        t1p1:team1_player1_id(name),
        t1p2:team1_player2_id(name),
        t2p1:team2_player1_id(name),
        t2p2:team2_player2_id(name)
      `)
      .eq("session_id", sessionId)
      .order("played_at", { ascending: false }),
    getDeletedPlayerIds(supabase),
  ]);

  return (data ?? []).filter((m) => !hasDeletedPlayer(m, deletedIds)).map((m) => ({
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
  absent?: boolean;
  isOpen?: boolean;
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

export async function getPlayerSessionHistory(
  playerId: string,
  options?: { includeTestSessions?: boolean },
): Promise<PlayerSessionStat[]> {
  const supabase = await createClient();
  const includeTest = options?.includeTestSessions ?? false;

  const allSessionsQuery = includeTest
    ? supabase.from("sessions").select("id, date").eq("status", "completed").order("date")
    : supabase.from("sessions").select("id, date").eq("status", "completed").eq("is_test_session", false).order("date");

  const activeSessionQuery = includeTest
    ? supabase.from("sessions").select("id, date").eq("status", "active").maybeSingle()
    : supabase.from("sessions").select("id, date").eq("status", "active").eq("is_test_session", false).maybeSingle();

  const [{ data: allSessions }, { data: activeSession }, { data: matchData }, { data: tallyData }] = await Promise.all([
    allSessionsQuery,
    activeSessionQuery,
    supabase
      .from("matches")
      .select(`
        session_id, winning_team,
        team1_player1_id, team1_player2_id,
        team2_player1_id, team2_player2_id,
        sessions(date, is_test_session)
      `)
      .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`),
    supabase
      .from("session_tally")
      .select("session_id, wins, losses, sessions(date, is_test_session)")
      .eq("player_id", playerId),
  ]);

  // Pre-populate every completed session as absent
  const sessionMap = new Map<string, { date: string; wins: number; losses: number; absent: boolean; isOpen?: boolean }>();
  for (const s of allSessions ?? []) {
    sessionMap.set(s.id, { date: s.date, wins: 0, losses: 0, absent: true });
  }
  if (activeSession) {
    sessionMap.set(activeSession.id, { date: activeSession.date, wins: 0, losses: 0, absent: true, isOpen: true });
  }

  for (const m of matchData ?? []) {
    const session = m.sessions as unknown as { date: string; is_test_session: boolean };
    if (!includeTest && session.is_test_session) continue;
    const entry = sessionMap.get(m.session_id);
    if (!entry) continue;
    entry.absent = false;
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    if (won) entry.wins++; else entry.losses++;
  }

  for (const t of tallyData ?? []) {
    const session = t.sessions as unknown as { date: string; is_test_session: boolean };
    if (!includeTest && session.is_test_session) continue;
    if (t.wins === 0 && t.losses === 0) continue;
    const entry = sessionMap.get(t.session_id);
    if (!entry || !entry.absent) continue; // not in set or already has match data
    entry.absent = false;
    entry.wins = t.wins;
    entry.losses = t.losses;
  }

  return Array.from(sessionMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, wins, losses, absent, isOpen }) => ({
      date,
      wins,
      losses,
      absent,
      isOpen,
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
  isTally?: boolean;
  tallyWins?: number;
  tallyLosses?: number;
  absent?: boolean;
  isOpen?: boolean;
}

export async function getPlayerMatchesBySession(
  playerId: string,
  options?: { includeTestSessions?: boolean },
): Promise<PlayerMatchBySession[]> {
  const supabase = await createClient();
  const includeTest = options?.includeTestSessions ?? false;

  const allSessionsQuery = includeTest
    ? supabase.from("sessions").select("id, date").eq("status", "completed").order("date")
    : supabase.from("sessions").select("id, date").eq("status", "completed").eq("is_test_session", false).order("date");

  const activeSessionQuery = includeTest
    ? supabase.from("sessions").select("id, date").eq("status", "active").maybeSingle()
    : supabase.from("sessions").select("id, date").eq("status", "active").eq("is_test_session", false).maybeSingle();

  const [{ data: allSessions }, { data: activeSession }, { data }, { data: tallyData }] = await Promise.all([
    allSessionsQuery,
    activeSessionQuery,
    supabase
      .from("matches")
      .select(`
        id, played_at, session_id, team1_score, team2_score, winning_team,
        team1_player1_id, team1_player2_id,
        team2_player1_id, team2_player2_id,
        sessions(date, is_test_session),
        t1p1:team1_player1_id(id, name),
        t1p2:team1_player2_id(id, name),
        t2p1:team2_player1_id(id, name),
        t2p2:team2_player2_id(id, name)
      `)
      .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
      .order("played_at", { ascending: true }),
    supabase
      .from("session_tally")
      .select("session_id, wins, losses, sessions(date, is_test_session)")
      .eq("player_id", playerId),
  ]);

  // Pre-populate every completed session as absent
  type SessionEntry = { date: string; matches: PlayerMatchRecord[]; isTally?: boolean; tallyWins?: number; tallyLosses?: number; absent: boolean; isOpen?: boolean };
  const sessionMap = new Map<string, SessionEntry>();
  for (const s of allSessions ?? []) {
    sessionMap.set(s.id, { date: s.date, matches: [], absent: true });
  }
  if (activeSession) {
    sessionMap.set(activeSession.id, { date: activeSession.date, matches: [], absent: true, isOpen: true });
  }

  for (const m of data ?? []) {
    const t1p1 = m.t1p1 as unknown as { id: string; name: string };
    const t1p2 = m.t1p2 as unknown as { id: string; name: string };
    const t2p1 = m.t2p1 as unknown as { id: string; name: string };
    const t2p2 = m.t2p2 as unknown as { id: string; name: string };
    const session = m.sessions as unknown as { date: string; is_test_session: boolean };
    if (!includeTest && session.is_test_session) continue;
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

    const entry = sessionMap.get(m.session_id);
    if (!entry) continue;
    entry.absent = false;
    entry.matches.push(record);
  }

  // Fill in tally-only sessions
  for (const t of tallyData ?? []) {
    const session = t.sessions as unknown as { date: string; is_test_session: boolean };
    if (!includeTest && session.is_test_session) continue;
    if (t.wins === 0 && t.losses === 0) continue;
    const entry = sessionMap.get(t.session_id);
    if (!entry || !entry.absent) continue;
    entry.absent = false;
    entry.isTally = true;
    entry.tallyWins = t.wins;
    entry.tallyLosses = t.losses;
  }

  return Array.from(sessionMap.entries())
    .map(([session_id, { date, matches, isTally, tallyWins, tallyLosses, absent, isOpen }]) => ({
      session_id, date, matches, isTally, tallyWins, tallyLosses, absent, isOpen,
    }))
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

export async function getSeasonMatchCount(options?: { includeTestSessions?: boolean; seasonId?: string }): Promise<number> {
  const supabase = await createClient();
  const includeTest = options?.includeTestSessions ?? false;
  const seasonId = options?.seasonId;

  let matchQuery = includeTest
    ? supabase.from("matches").select("*, sessions!inner(is_test_session, season_id)", { count: "exact", head: true }).eq("match_type", "regular")
    : supabase
        .from("matches")
        .select("*, sessions!inner(is_test_session, season_id)", { count: "exact", head: true })
        .eq("sessions.is_test_session", false)
        .eq("match_type", "regular");

  if (seasonId) {
    matchQuery = matchQuery.eq("sessions.season_id", seasonId);
  }

  let tallyQuery = includeTest
    ? supabase.from("session_tally").select("wins, sessions!inner(is_test_session, season_id)")
    : supabase
        .from("session_tally")
        .select("wins, sessions!inner(is_test_session, season_id)")
        .eq("sessions.is_test_session", false);

  if (seasonId) {
    tallyQuery = tallyQuery.eq("sessions.season_id", seasonId);
  }

  const [{ count: matchCount }, { data: tallyData }] = await Promise.all([matchQuery, tallyQuery]);

  // Each match has 2 winners; tally stores per-player wins so total matches = SUM(wins) / 2
  const tallyMatchCount = Math.floor(
    (tallyData ?? []).reduce((sum, t) => sum + (t.wins ?? 0), 0) / 2
  );

  return (matchCount ?? 0) + tallyMatchCount;
}

export async function getSessionScoreboard(sessionId: string): Promise<PlayerSessionStats[]> {
  const supabase = await createClient();

  const [{ data: matches }, deletedIds] = await Promise.all([
    supabase
      .from("matches")
      .select(`
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team, team1_score, team2_score,
        t1p1:team1_player1_id(name, skill_level, user_id, is_admin),
        t1p2:team1_player2_id(name, skill_level, user_id, is_admin),
        t2p1:team2_player1_id(name, skill_level, user_id, is_admin),
        t2p2:team2_player2_id(name, skill_level, user_id, is_admin)
      `)
      .eq("session_id", sessionId),
    getDeletedPlayerIds(supabase),
  ]);

  const stats = new Map<string, PlayerSessionStats>();

  function ensurePlayer(id: string, player: { name: string; skill_level: number; user_id: string | null; is_admin: boolean }) {
    if (!stats.has(id)) {
      stats.set(id, { player_id: id, name: player.name, skill_level: player.skill_level, user_id: player.user_id, is_admin: player.is_admin, wins: 0, losses: 0, matches_played: 0, points: 0 });
    }
  }

  for (const m of (matches ?? []).filter((m) => !hasDeletedPlayer(m, deletedIds))) {
    const t1p1 = m.t1p1 as unknown as { name: string; skill_level: number; user_id: string | null; is_admin: boolean };
    const t1p2 = m.t1p2 as unknown as { name: string; skill_level: number; user_id: string | null; is_admin: boolean };
    const t2p1 = m.t2p1 as unknown as { name: string; skill_level: number; user_id: string | null; is_admin: boolean };
    const t2p2 = m.t2p2 as unknown as { name: string; skill_level: number; user_id: string | null; is_admin: boolean };

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

    for (const pid of team1) {
      stats.get(pid)!.points += m.team1_score ?? 0;
    }
    for (const pid of team2) {
      stats.get(pid)!.points += m.team2_score ?? 0;
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    const aPct = a.matches_played ? a.wins / a.matches_played : 0;
    const bPct = b.matches_played ? b.wins / b.matches_played : 0;
    if (bPct !== aPct) return bPct - aPct;
    return b.matches_played - a.matches_played;
  });
}
