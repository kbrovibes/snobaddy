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
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return [];

  return (data ?? []).map((m: any) => ({
    ...m,
    team1_names: [m.t1p1.name, m.t1p2.name],
    team2_names: [m.t2p1.name, m.t2p2.name],
  }));
}

/** Soft-delete so the scorer remembers and penalises re-picking the same group. */
export async function deleteProposedMatch(id: string) {
  await supabase
    .from("proposed_matches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
}

const COURTS = 2; // matches that run simultaneously

/**
 * THE ALGORITHM
 * Proposes matches up to 4 total, organized in waves of COURTS matches.
 * Wave 1 = matches 1 & 2 (run simultaneously). Wave 2 = matches 3 & 4 (run after wave 1).
 * Players are only locked within a wave, so wave 2 can reuse wave 1 players.
 *
 * Deletion memory: soft-deleted proposals are loaded and added to workingHistory so the
 * -5000 exact-duplicate penalty fires before picking a previously-rejected group again.
 * The deleted group CAN still be selected if it's the only viable option.
 */
export async function proposeNextMatches(sessionId: string) {
  // 1. Get current state
  const { data: checkedIn } = await supabase
    .from("session_players")
    .select("player_id, checked_in_at, players(id, name, skill_level)")
    .eq("session_id", sessionId)
    .is("checked_out_at", null);

  const players = (checkedIn ?? []).map((cp: any) => ({
    ...cp.players,
    checked_in_at: cp.checked_in_at,
  }));
  if (players.length < 4) return { error: "Not enough players checked in" };

  // Active (non-deleted) proposals count toward the 4-match target and drive wave logic.
  const { data: existingProposed } = await supabase
    .from("proposed_matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  // Soft-deleted proposals: add to history so scorer penalises re-picking same group.
  const { data: deletedProposed } = await supabase
    .from("proposed_matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId)
    .not("deleted_at", "is", null);

  const { data: recentMatches } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId)
    .order("played_at", { ascending: false })
    .limit(2);

  const { data: sessionHistory } = await supabase
    .from("matches")
    .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, played_at")
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

  // 3. Build wait-time map: minutes since each player last played (or checked in).
  // Players who have been waiting longer get a scoring bonus so they play sooner.
  const now = Date.now();
  const lastPlayedAt = new Map<string, number>(); // player_id → ms timestamp
  for (const m of sessionHistory ?? []) {
    if (!m.played_at) continue;
    const t = new Date(m.played_at).getTime();
    for (const pid of [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]) {
      if (!lastPlayedAt.has(pid) || t > lastPlayedAt.get(pid)!) {
        lastPlayedAt.set(pid, t);
      }
    }
  }
  const waitMinutes = new Map<string, number>();
  for (const p of players) {
    // Fall back to checked_in_at if never played; fall back to now if no timestamp at all
    const checkedInMs = p.checked_in_at ? new Date(p.checked_in_at).getTime() : now;
    const sinceMs = now - Math.max(checkedInMs, lastPlayedAt.get(p.id) ?? checkedInMs);
    waitMinutes.set(p.id, Math.max(0, sinceMs / 60_000));
  }

  // 4. Fill up to 4 proposals using wave-based locking with fresh-player preference.
  //
  // Waves: only COURTS matches run at once. Within a wave, a player can't appear twice.
  // Between waves the hard lock resets, BUT wave 2 prefers "fresh" players (not used in
  // wave 1) before falling back to the full pool.
  //
  // Working history = completed matches + deleted proposals + newly proposed matches.
  // Deleted proposals carry the same -5000 exact-duplicate penalty as any repeated match,
  // so the scorer strongly avoids re-picking them unless there is no other option.
  const existingCount = existingProposed?.length ?? 0;
  const needed = 4 - existingCount;
  const newProposals = [];

  const workingHistory: Array<{
    team1_player1_id: string;
    team1_player2_id: string;
    team2_player1_id: string;
    team2_player2_id: string;
  }> = [
    ...(sessionHistory ?? []),
    ...(deletedProposed ?? []),   // ← deleted proposals seeded here
  ];

  // Players used in wave 1 (hard-locked from wave 2 preference pool, but not excluded).
  const wave1Players = new Set<string>();

  // Seed per-wave state from existing active proposals.
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

    const match = findBestMatch(available, justPlayed, workingHistory, waitMinutes);
    if (match) {
      newProposals.push({
        session_id: sessionId,
        team1_player1_id: match.players[0].id,
        team1_player2_id: match.players[1].id,
        team2_player1_id: match.players[2].id,
        team2_player2_id: match.players[3].id,
        avg_skill_diff: match.skillDiff
      });
      // Register this proposal so future slots in this batch avoid repeating it.
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

/**
 * Called when a player checks out mid-session.
 * For each active proposed match containing that player, tries to substitute the
 * best available replacement (minimises new skill diff). Falls back to soft-deleting
 * the match if no eligible replacement exists.
 */
export async function replacePlayerInProposedMatches(
  sessionId: string,
  departedPlayerId: string
) {
  // Active proposed matches that include the departed player
  const { data: affected } = await supabase
    .from("proposed_matches")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .or(
      `team1_player1_id.eq.${departedPlayerId},` +
      `team1_player2_id.eq.${departedPlayerId},` +
      `team2_player1_id.eq.${departedPlayerId},` +
      `team2_player2_id.eq.${departedPlayerId}`
    );

  if (!affected?.length) return;

  // All checked-in players (excluding the one who just left), with skill levels
  const { data: checkedIn } = await supabase
    .from("session_players")
    .select("player_id, players(id, name, skill_level)")
    .eq("session_id", sessionId)
    .is("checked_out_at", null)
    .neq("player_id", departedPlayerId);

  const checkedInById: Record<string, any> = {};
  (checkedIn ?? []).forEach((cp: any) => {
    checkedInById[cp.players.id] = cp.players;
  });

  // All player skill levels (for the 3 remaining players in each affected match)
  const { data: allPlayerRows } = await supabase
    .from("players")
    .select("id, skill_level");
  const skillOf: Record<string, number> = {};
  (allPlayerRows ?? []).forEach((p: any) => { skillOf[p.id] = p.skill_level ?? 3; });

  // Snapshot of active proposed matches so we can track who is already locked
  const { data: allActive } = await supabase
    .from("proposed_matches")
    .select("id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  // Mutable working copy so each iteration sees the updated locked state
  const activeSnapshot = [...(allActive ?? [])];

  for (const match of affected) {
    // Players locked in OTHER active proposed matches (not this one)
    const lockedElsewhere = new Set<string>();
    activeSnapshot.forEach(m => {
      if (m.id !== match.id) {
        lockedElsewhere.add(m.team1_player1_id);
        lockedElsewhere.add(m.team1_player2_id);
        lockedElsewhere.add(m.team2_player1_id);
        lockedElsewhere.add(m.team2_player2_id);
      }
    });

    // Eligible replacements: checked-in, not in another proposed match
    const candidates = Object.values(checkedInById).filter(
      p => !lockedElsewhere.has(p.id)
    );

    if (candidates.length === 0) {
      // No one available — soft-delete and move on
      await supabase
        .from("proposed_matches")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", match.id);
      const idx = activeSnapshot.findIndex(m => m.id === match.id);
      if (idx >= 0) activeSnapshot.splice(idx, 1);
      continue;
    }

    // Determine which team the departed player was on, find their teammate's ID
    const onTeam1 =
      match.team1_player1_id === departedPlayerId ||
      match.team1_player2_id === departedPlayerId;
    const teammateId = onTeam1
      ? (match.team1_player1_id === departedPlayerId
          ? match.team1_player2_id
          : match.team1_player1_id)
      : (match.team2_player1_id === departedPlayerId
          ? match.team2_player2_id
          : match.team2_player1_id);

    const opposingSkill = onTeam1
      ? (skillOf[match.team2_player1_id] ?? 3) + (skillOf[match.team2_player2_id] ?? 3)
      : (skillOf[match.team1_player1_id] ?? 3) + (skillOf[match.team1_player2_id] ?? 3);

    // Pick the replacement that minimises the new skill diff
    let bestCandidate = candidates[0];
    let bestDiff = Infinity;
    for (const candidate of candidates) {
      const newTeamSkill = (skillOf[teammateId] ?? 3) + (candidate.skill_level ?? 3);
      const diff = Math.abs(newTeamSkill - opposingSkill);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestCandidate = candidate;
      }
    }

    // Build update payload — replace the departed player's slot only
    const slotKey =
      match.team1_player1_id === departedPlayerId ? "team1_player1_id" :
      match.team1_player2_id === departedPlayerId ? "team1_player2_id" :
      match.team2_player1_id === departedPlayerId ? "team2_player1_id" :
                                                    "team2_player2_id";

    const updated = { ...match, [slotKey]: bestCandidate.id };
    const newSkillDiff = Math.abs(
      (skillOf[updated.team1_player1_id] ?? 3) + (skillOf[updated.team1_player2_id] ?? 3) -
      (skillOf[updated.team2_player1_id] ?? 3) - (skillOf[updated.team2_player2_id] ?? 3)
    );

    await supabase
      .from("proposed_matches")
      .update({ [slotKey]: bestCandidate.id, avg_skill_diff: newSkillDiff })
      .eq("id", match.id);

    // Reflect the change in our working snapshot for subsequent iterations
    const idx = activeSnapshot.findIndex(m => m.id === match.id);
    if (idx >= 0) activeSnapshot[idx] = { ...activeSnapshot[idx], [slotKey]: bestCandidate.id };
  }
}

function findBestMatch(available: any[], justPlayed: Set<string>, history: any[], waitMinutes: Map<string, number>) {
  const sortedAvailable = [...available].sort((a, b) => {
    const aRested = justPlayed.has(a.id) ? 1 : 0;
    const bRested = justPlayed.has(b.id) ? 1 : 0;
    return aRested - bRested;
  });

  const anchor = sortedAvailable[0];
  const others = sortedAvailable.slice(1);

  let bestMatch = null;
  let bestScore = -Infinity;

  const sampleSize = others.length > 20 ? 20 : others.length;
  const candidates = others.slice(0, sampleSize);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const p1 = anchor;
        const p2 = candidates[i];
        const p3 = candidates[j];
        const p4 = candidates[k];

        const lineups = [
          { t1: [p1, p2], t2: [p3, p4] },
          { t1: [p1, p3], t2: [p2, p4] },
          { t1: [p1, p4], t2: [p2, p3] }
        ];

        for (const lineup of lineups) {
          const score = scoreMatch(lineup.t1, lineup.t2, justPlayed, history, waitMinutes);
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

function scoreMatch(t1: any[], t2: any[], justPlayed: Set<string>, history: any[], waitMinutes: Map<string, number>) {
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
  const skills = allPlayers.map(p => p.skill_level);
  for (let i = 0; i < 4; i++) {
    const others = skills.filter((_, idx) => idx !== i);
    const avgOthers = others.reduce((a, b) => a + b, 0) / 3;
    if (Math.abs(skills[i] - avgOthers) > 2.5) score -= 1000;
  }

  // 4. Diversity (Pairing History)
  // "history" includes completed matches, soft-deleted proposals, and intra-batch proposals.
  // Same 4-player group (regardless of team split) gets -5000 — strong last-resort deterrent.
  const pids = new Set(allPlayers.map(p => p.id));
  const t1Pair = new Set([t1[0].id, t1[1].id]);
  const t2Pair = new Set([t2[0].id, t2[1].id]);
  for (const m of history) {
    const hPids = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id];
    const intersection = hPids.filter(id => pids.has(id));
    if (intersection.length === 4) score -= 5000;        // Exact same 4-player group
    else if (intersection.length >= 3) score -= 500;     // Near-identical group
    // Same team pairing on same side
    const mT1Pair = new Set([m.team1_player1_id, m.team1_player2_id]);
    const mT2Pair = new Set([m.team2_player1_id, m.team2_player2_id]);
    if ([...t1Pair].every(id => mT1Pair.has(id)) || [...t1Pair].every(id => mT2Pair.has(id)) ||
        [...t2Pair].every(id => mT1Pair.has(id)) || [...t2Pair].every(id => mT2Pair.has(id))) {
      score -= 150;
    }
  }

  // 5. Wait-time fairness: reward including players who have been waiting longer.
  // 3 pts/min — a 30-min wait adds +90, meaningful vs the -100/skill-level-diff penalty.
  for (const p of allPlayers) {
    score += (waitMinutes.get(p.id) ?? 0) * 3;
  }

  // 6. Phase Logic
  const isConvergence = history.length > 10;
  const skillRange = Math.max(...skills) - Math.min(...skills);
  if (isConvergence) {
    score -= (skillRange * 50);
  } else {
    if (skillRange >= 3) score += 100;
  }

  return score;
}
