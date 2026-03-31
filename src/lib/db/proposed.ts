import { supabase } from "@/lib/supabase";

export interface ProposedMatch {
  id: string;
  session_id: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  avg_skill_diff: number;
  created_at: string;
  // Included names for UI convenience when fetching
  team1_names?: [string, string];
  team2_names?: [string, string];
}

export async function getProposedMatches(sessionId: string): Promise<ProposedMatch[]> {
  const { data, error } = await supabase
    .from("proposed_matches")
    .select(`
      *,
      t1p1:team1_player1_id(name),
      t1p2:team1_player2_id(name),
      t2p1:team2_player1_id(name),
      t2p2:team2_player2_id(name)
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return [];

  return (data ?? []).map((m: any) => ({
    ...m,
    team1_names: [m.t1p1.name, m.t1p2.name],
    team2_names: [m.t2p1.name, m.t2p2.name],
  }));
}

export async function deleteProposedMatch(id: string) {
  await supabase.from("proposed_matches").delete().eq("id", id);
}

const COURTS = 2; // matches that run simultaneously

/**
 * THE ALGORITHM
 * Proposes matches up to 4 total, organized in waves of COURTS matches.
 * Wave 1 = matches 1 & 2 (run simultaneously). Wave 2 = matches 3 & 4 (run after wave 1).
 * Players are only locked within a wave, so wave 2 can reuse wave 1 players.
 */
export async function proposeNextMatches(sessionId: string) {
  // 1. Get current state
  const { data: checkedIn } = await supabase
    .from("session_players")
    .select("player_id, players(id, name, skill_level)")
    .eq("session_id", sessionId)
    .is("checked_out_at", null);

  const players = (checkedIn ?? []).map((cp: any) => cp.players);
  if (players.length < 4) return { error: "Not enough players checked in" };

  const { data: existingProposed } = await supabase
    .from("proposed_matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId);

  const { data: recentMatches } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId)
    .order("played_at", { ascending: false })
    .limit(2);

  const { data: sessionHistory } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId);

  // 2. Identify players who just played (Back-to-back detection)
  const justPlayed = new Set<string>();
  if (recentMatches && recentMatches.length > 0) {
    const last = recentMatches[0];
    justPlayed.add(last.team1_player1_id);
    justPlayed.add(last.team1_player2_id);
    justPlayed.add(last.team2_player1_id);
    justPlayed.add(last.team2_player2_id);
  }

  // 3. Fill up to 4 proposals using wave-based locking with fresh-player preference.
  //
  // Waves: only COURTS matches run at once. Within a wave, a player can't appear twice.
  // Between waves the hard lock resets, BUT wave 2 prefers "fresh" players (not used in
  // wave 1) before falling back to the full pool. This prevents wave 2 from blindly
  // repeating the same matchups as wave 1.
  //
  // Duplicate guard: newly proposed matches are appended to the working history so the
  // scoring function penalises exact repeats within the same batch.
  const existingCount = existingProposed?.length ?? 0;
  const needed = 4 - existingCount;
  const newProposals = [];

  // Working history starts with completed matches; new proposals are appended as we go
  // so that each subsequent call to findBestMatch sees the full picture.
  const workingHistory: typeof sessionHistory = [...(sessionHistory ?? [])];

  // Players used in wave 1 (hard-locked from wave 2 preference pool, but not excluded).
  const wave1Players = new Set<string>();

  // Seed per-wave state from existing proposals.
  const currentWaveOffset = existingCount % COURTS;
  const waveLocked = new Set<string>();
  existingProposed?.forEach((m, idx) => {
    const pids = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id];
    if (Math.floor(idx / COURTS) === 0) pids.forEach(id => wave1Players.add(id));
    if (idx >= existingCount - currentWaveOffset) pids.forEach(id => waveLocked.add(id));
  });

  for (let i = 0; i < needed; i++) {
    const absoluteSlot = existingCount + i;
    const slotInWave = absoluteSlot % COURTS;
    const waveNum = Math.floor(absoluteSlot / COURTS);

    if (slotInWave === 0) {
      // New wave — hard lock resets (players can play again)
      waveLocked.clear();
    }

    // In wave 2+, prefer players who haven't played yet (not in wave1Players).
    // Only fall back to the full pool if there aren't 4 fresh players left.
    let available: any[];
    if (waveNum >= 1) {
      const fresh = players.filter(p => !waveLocked.has(p.id) && !wave1Players.has(p.id));
      available = fresh.length >= 4
        ? fresh
        : players.filter(p => !waveLocked.has(p.id));
    } else {
      available = players.filter(p => !waveLocked.has(p.id));
    }

    if (available.length < 4) break;

    const match = findBestMatch(available, justPlayed, workingHistory);
    if (match) {
      newProposals.push({
        session_id: sessionId,
        team1_player1_id: match.players[0].id,
        team1_player2_id: match.players[1].id,
        team2_player1_id: match.players[2].id,
        team2_player2_id: match.players[3].id,
        avg_skill_diff: match.skillDiff
      });
      // Register this proposal in working history so future slots avoid repeating it.
      workingHistory.push({
        team1_player1_id: match.players[0].id,
        team1_player2_id: match.players[1].id,
        team2_player1_id: match.players[2].id,
        team2_player2_id: match.players[3].id,
      });
      match.players.forEach(p => {
        waveLocked.add(p.id);
        if (waveNum === 0) wave1Players.add(p.id);
      });
    }
  }

  if (newProposals.length > 0) {
    await supabase.from("proposed_matches").insert(newProposals);
  }

  return { count: newProposals.length };
}

function findBestMatch(available: any[], justPlayed: Set<string>, history: any[]) {
  // To avoid C(N, 4) we pick the 'most rested' player first
  // Rested = Not in justPlayed, and has fewest matches today
  const sortedAvailable = [...available].sort((a, b) => {
    const aRested = justPlayed.has(a.id) ? 1 : 0;
    const bRested = justPlayed.has(b.id) ? 1 : 0;
    return aRested - bRested;
  });

  const anchor = sortedAvailable[0];
  const others = sortedAvailable.slice(1);

  let bestMatch = null;
  let bestScore = -Infinity;

  // We'll sample combinations if 'others' is large, but for 50 people C(49, 3) is 18k. 
  // For a quick greedy, we can limit the search or just do it.
  const sampleSize = others.length > 20 ? 20 : others.length;
  const candidates = others.slice(0, sampleSize);

  // Simplified combination search for the remaining 3 players
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const p1 = anchor;
        const p2 = candidates[i];
        const p3 = candidates[j];
        const p4 = candidates[k];

        // Evaluate all 3 ways to split 4 people into 2 teams
        const lineups = [
          { t1: [p1, p2], t2: [p3, p4] },
          { t1: [p1, p3], t2: [p2, p4] },
          { t1: [p1, p4], t2: [p2, p3] }
        ];

        for (const lineup of lineups) {
          const score = scoreMatch(lineup.t1, lineup.t2, justPlayed, history);
          if (score > bestScore) {
            bestScore = score;
            const t1Skill = lineup.t1[0].skill_level + lineup.t1[1].skill_level;
            const t2Skill = lineup.t2[0].skill_level + lineup.t2[1].skill_level;
            bestMatch = {
              players: [lineup.t1[0], lineup.t1[1], lineup.t2[0], lineup.t2[1]],
              skillDiff: Math.abs(t1Skill - t2Skill),
              score
            };
          }
        }
      }
    }
  }

  return bestMatch;
}

function scoreMatch(t1: any[], t2: any[], justPlayed: Set<string>, history: any[]) {
  let score = 1000;

  const t1Skill = t1[0].skill_level + t1[1].skill_level;
  const t2Skill = t2[0].skill_level + t2[1].skill_level;
  const diff = Math.abs(t1Skill - t2Skill);

  // 1. Anti-Back-to-Back (Massive Penalty)
  const allPlayers = [...t1, ...t2];
  for (const p of allPlayers) {
    if (justPlayed.has(p.id)) score -= 2000;
  }

  // 2. Team Balance
  score -= (diff * 100);

  // 3. Sanity Check: Avoid "isolated" skill levels
  // If one player is > 2.5 levels away from the average of the others
  const skills = allPlayers.map(p => p.skill_level);
  for (let i = 0; i < 4; i++) {
    const others = skills.filter((_, idx) => idx !== i);
    const avgOthers = others.reduce((a, b) => a + b, 0) / 3;
    if (Math.abs(skills[i] - avgOthers) > 2.5) score -= 1000;
  }

  // 4. Diversity (Pairing History)
  // Penalise exact or near-exact repetition of a previous match.
  // "history" includes both completed matches AND already-proposed matches in the current
  // batch, so this fires for intra-batch duplicates too.
  const pids = new Set(allPlayers.map(p => p.id));
  const t1Pair = new Set([t1[0].id, t1[1].id]);
  const t2Pair = new Set([t2[0].id, t2[1].id]);
  for (const m of history) {
    const hPids = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id];
    const intersection = hPids.filter(id => pids.has(id));
    // Same 4-player group regardless of team split — strong deterrent
    if (intersection.length === 4) score -= 5000;
    // 3-player overlap — high penalty
    else if (intersection.length >= 3) score -= 500;
    // Same team pairing (same two players on the same side)
    const mT1Pair = new Set([m.team1_player1_id, m.team1_player2_id]);
    const mT2Pair = new Set([m.team2_player1_id, m.team2_player2_id]);
    const t1MatchesMT1 = [...t1Pair].every(id => mT1Pair.has(id));
    const t1MatchesMT2 = [...t1Pair].every(id => mT2Pair.has(id));
    const t2MatchesMT1 = [...t2Pair].every(id => mT1Pair.has(id));
    const t2MatchesMT2 = [...t2Pair].every(id => mT2Pair.has(id));
    if (t1MatchesMT1 || t1MatchesMT2 || t2MatchesMT1 || t2MatchesMT2) score -= 150;
  }

  // 5. Phase Logic
  const avgMatches = history.length * 4 / (history.length > 0 ? history.length : 1); // Mocked logic
  // Mixing vs Convergence
  const isConvergence = history.length > 10; // Simple heuristic for "late session"
  
  const skillRange = Math.max(...skills) - Math.min(...skills);
  if (isConvergence) {
    // Late session: favor tighter skill groups
    score -= (skillRange * 50);
  } else {
    // Early session: favor skill mixing (spread)
    if (skillRange >= 3) score += 100;
  }

  return score;
}
