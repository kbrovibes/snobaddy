import type { PlayerRow, PairRow, SeasonStatsSnapshot } from "./stats";

interface GenerateOptions {
  extraContext?: string | null;
  generatedAt?: Date;
}

// Players who have asked not to be eligible for awards. Match by lowercased name —
// the IDs are stable but names are what the rest of the app shows.
const AWARD_EXCLUDE_NAMES: Set<string> = new Set(["sekhar durga"]);

function pct(n: number) { return `${n.toFixed(1)}%`; }
function fmtSigned(n: number | null | undefined) {
  if (n == null) return "n/a";
  if (n > 0) return `+${n}`;
  return `${n}`;
}
function isEligible(p: PlayerRow): boolean {
  return !AWARD_EXCLUDE_NAMES.has(p.name.toLowerCase());
}
function firstName(name: string): string {
  return name.split(/\s+/)[0];
}

function bucketAverages(players: PlayerRow[], minGames: number) {
  const sums = new Map<number, { games: number; wins: number; count: number }>();
  for (const p of players) {
    if (p.games < minGames) continue;
    const slot = sums.get(p.skill_level) ?? { games: 0, wins: 0, count: 0 };
    slot.games += p.games;
    slot.wins += p.wins;
    slot.count += 1;
    sums.set(p.skill_level, slot);
  }
  const out = new Map<number, number>();
  for (const [k, v] of sums) out.set(k, v.games > 0 ? (100 * v.wins) / v.games : 50);
  return out;
}

export function generateNewsletter(snap: SeasonStatsSnapshot, opts: GenerateOptions = {}): { title: string; content_md: string } {
  const generatedAt = opts.generatedAt ?? new Date();
  const title = `${snap.season_name} — Season Recap`;

  if (snap.real_session_count === 0) {
    return {
      title,
      content_md: [
        `# ${title}`,
        "",
        "_The season is still warming up — no completed sessions yet, so the stats are quiet._",
        "",
        "Check back after a few Mondays.",
      ].join("\n"),
    };
  }

  const totalSessions = snap.real_session_count;
  const fullDetailSessions = snap.full_detail_session_count;
  const tallySessions = snap.tally_session_count;
  const players = snap.players;
  const totalDistinct = snap.unique_players;

  // ─── Leaderboard-aligned awards ───────────────────────────────────
  // Mirror the leaderboard's logic exactly (see LeaderboardTable.tsx):
  //   Badminton Nut: top 3 by games played (tiebreak: name asc)
  //   Nut Cracker:   top 3 by win % among players with ≥ floor(top_nut/2) games
  // Then drop self-excluded players (e.g. Sekhar).
  const eligible = players.filter(isEligible);

  const badmintonTop3 = [...eligible]
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 3);
  const badmintonNut = badmintonTop3[0] ?? null;
  const badmintonRunners = badmintonTop3.slice(1);

  const minMatches = badmintonNut ? Math.floor(badmintonNut.games / 2) : 0;
  const cutTop3 = [...eligible]
    .filter((p) => p.games >= minMatches && p.games > 0)
    .sort((a, b) => (b.win_pct - a.win_pct) || (b.games - a.games))
    .slice(0, 3);
  const nutCracker = cutTop3[0] ?? null;
  const nutRunners = cutTop3.slice(1);

  // ─── Other sorts (used in fun observations) ───────────────────────
  const MIN_GAMES_FOR_RATE = Math.max(10, Math.ceil(totalSessions * 1.5));
  const qualifiedForRate = players.filter((p) => p.games >= MIN_GAMES_FOR_RATE);

  // UBR movers (whole roster — UBR rises/drops are facts about the player,
  // not really an award where Sekhar's self-exclusion preference matters).
  const withDelta = players.filter((p) => p.ubr_delta != null) as (PlayerRow & { ubr_delta: number })[];
  const climbers = [...withDelta].sort((a, b) => b.ubr_delta - a.ubr_delta).slice(0, 5);
  const sliders = [...withDelta].sort((a, b) => a.ubr_delta - b.ubr_delta).slice(0, 5);

  // Pairs
  const pairs = snap.pairs;
  const mostPlayedPair = pairs[0];
  const bestPairs = [...pairs].filter((p) => p.games >= 3).sort((a, b) => b.win_pct - a.win_pct || b.games - a.games);
  const worstPairs = [...pairs].filter((p) => p.games >= 3).sort((a, b) => a.win_pct - b.win_pct || b.games - a.games);
  const cleanPairs = pairs.filter((p) => p.games >= 4 && p.losses === 0);
  const winlessPairs = pairs.filter((p) => p.games >= 3 && p.wins === 0);

  // Skill-bucket averages for the Math Corner
  const bucketAvg = bucketAverages(players, MIN_GAMES_FOR_RATE);
  const overperformers = qualifiedForRate
    .map((p) => ({ p, expected: bucketAvg.get(p.skill_level) ?? 50, delta: p.win_pct - (bucketAvg.get(p.skill_level) ?? 50) }))
    .sort((a, b) => b.delta - a.delta);

  // Gender split
  const female = players.filter((p) => p.gender === "female");
  const male = players.filter((p) => p.gender === "male");

  // ─── Assemble the markdown ────────────────────────────────────────
  const lines: string[] = [];
  const dateRange = `${formatDate(snap.start_date)} – ${formatDate(snap.lock_date ?? snap.end_date)}`;

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_${dateRange}_`);
  lines.push("");

  // ─── Intro ────────────────────────────────────────────────────────
  lines.push("## A Brief Word From The Whiteboard");
  lines.push("");
  if (opts.extraContext && opts.extraContext.trim().length > 0) {
    lines.push(opts.extraContext.trim());
    lines.push("");
  }
  // Warmer intro — narrator first, numbers later, no useless-trivia counts.
  lines.push(
    `Another season of Mondays and Thursdays at Snoqualmie, and somehow we made it through ${totalSessions} of them without anyone retiring on the spot. Some nights were full-detail, every match logged with names and scores; other nights the whiteboard caught the chaos faster than any phone could. Either way: birdies flew, knees protested, and the kids laughed at the grown-ups taking themselves too seriously.`
  );
  lines.push("");
  lines.push(
    `Below are the people who showed up, the partners who somehow always won together, and the moments worth screenshotting. Names are real. Stats are checked against the leaderboard you all squint at in the parking lot afterwards. Excuses are optional.`
  );
  lines.push("");

  // ─── 🥜 Badminton Nut (leaderboard award + runners-up) ────────────
  if (badmintonNut) {
    lines.push("## 🥜 The Badminton Nut");
    lines.push("");
    lines.push("_For the person who simply could not stop showing up._");
    lines.push("");
    lines.push(
      `🏆 **${badmintonNut.name}** — ${badmintonNut.games} games (${badmintonNut.wins}–${badmintonNut.losses}, ${pct(badmintonNut.win_pct)}). ` +
      `Has logged more time on a Snoqualmie court this season than most of us have logged on our couches.`
    );
    if (badmintonRunners.length > 0) {
      lines.push("");
      lines.push("**Runners-up:**");
      for (const r of badmintonRunners) {
        const gap = badmintonNut.games - r.games;
        lines.push(`- 🥈 **${r.name}** — ${r.games} games${gap > 0 ? `, ${gap} behind the leader` : ""} (${r.wins}–${r.losses}, ${pct(r.win_pct)})`);
      }
    }
    lines.push("");
  }

  // ─── ✂️ Nut Cracker (leaderboard award + runners-up) ─────────────
  if (nutCracker) {
    lines.push("## ✂️ The Nut Cracker");
    lines.push("");
    lines.push(`_For the highest win rate among players with at least ${minMatches} games — the same threshold the leaderboard uses._`);
    lines.push("");
    lines.push(
      `🏆 **${nutCracker.name}** — ${pct(nutCracker.win_pct)} (${nutCracker.wins}–${nutCracker.losses} over ${nutCracker.games} games). ` +
      `Calmly walked onto a court, did the math nobody asked for, and walked off again with the better number.`
    );
    if (nutRunners.length > 0) {
      lines.push("");
      lines.push("**Runners-up:**");
      for (const r of nutRunners) {
        lines.push(`- 🥈 **${r.name}** — ${pct(r.win_pct)} (${r.wins}–${r.losses} over ${r.games} games)`);
      }
    }
    lines.push("");
  }

  // ─── 📐 Math Corner ──────────────────────────────────────────────
  lines.push("## 📐 The Math Corner: Who Was *Actually* Efficient?");
  lines.push("");
  lines.push(
    `Wins are nice, but they're partly a function of who showed up the most. To find players who actually outperformed expectations, we compare each person's win rate against the average win rate of *everyone at the same skill level this season*.`
  );
  lines.push("");
  lines.push("**Average win rate by skill bucket** (qualified players only — at least " + MIN_GAMES_FOR_RATE + " games):");
  lines.push("");
  lines.push("| Skill | Avg win % | Qualified players |");
  lines.push("|:---:|---:|---:|");
  const skillsPresent = [...new Set(qualifiedForRate.map((p) => p.skill_level))].sort();
  for (const s of skillsPresent) {
    const inBucket = qualifiedForRate.filter((p) => p.skill_level === s);
    const avg = bucketAvg.get(s) ?? 0;
    lines.push(`| ${s} | ${avg.toFixed(1)}% | ${inBucket.length} |`);
  }
  lines.push("");
  if (overperformers.length > 0) {
    lines.push("### Top over-performers (vs. their own skill bucket)");
    lines.push("");
    lines.push("| Player | Skill | Win % | Bucket Avg | Δ |");
    lines.push("|---|:---:|---:|---:|---:|");
    overperformers.slice(0, 5).forEach(({ p, expected, delta }) => {
      lines.push(`| ${p.name} | ${p.skill_level} | ${pct(p.win_pct)} | ${expected.toFixed(1)}% | **${fmtSigned(Math.round(delta * 10) / 10)}pp** |`);
    });
    lines.push("");
    const star = overperformers.find((o) => o.delta > 0);
    if (star) {
      lines.push(
        `A level-${star.p.skill_level} player would normally win about ${star.expected.toFixed(0)}% of their matches in this room. ` +
        `${star.p.name} won **${pct(star.p.win_pct)}**. That's a ${(star.delta).toFixed(1)}-point overshoot — which in scientific terms means *${firstName(star.p.name)} is misclassified, and we should all be slightly nervous.*`
      );
      lines.push("");
    }
  }
  const under = overperformers.filter((o) => o.delta < 0).slice(-3).reverse();
  if (under.length > 0) {
    lines.push("### And the rating system would like a quiet word with…");
    lines.push("");
    under.forEach(({ p, expected, delta }) => {
      lines.push(`- **${p.name}** (level ${p.skill_level}): ${pct(p.win_pct)} vs. ${expected.toFixed(1)}% bucket average (**${fmtSigned(Math.round(delta * 10) / 10)}pp**). Hot tea recommended.`);
    });
    lines.push("");
  }

  // UBR movers
  if (climbers.length > 0) {
    lines.push("### UBR Rating Risers");
    lines.push("");
    lines.push("| Player | Skill | Start → End | Δ |");
    lines.push("|---|:---:|---|---:|");
    climbers.forEach((p) => {
      lines.push(`| ${p.name} | ${p.skill_level} | ${p.ubr_start} → ${p.ubr_end} | **${fmtSigned(p.ubr_delta)}** |`);
    });
    lines.push("");
  }
  if (sliders.length > 0 && sliders[0].ubr_delta < 0) {
    lines.push("### UBR Reality Checks");
    lines.push("");
    lines.push("| Player | Skill | Start → End | Δ |");
    lines.push("|---|:---:|---|---:|");
    sliders.forEach((p) => {
      lines.push(`| ${p.name} | ${p.skill_level} | ${p.ubr_start} → ${p.ubr_end} | **${fmtSigned(p.ubr_delta)}** |`);
    });
    lines.push("");
  }

  // ─── 🔍 Fun Observations ─────────────────────────────────────────
  lines.push("## 🔍 Fun Observations (the part you'll actually screenshot)");
  lines.push("");

  const obs: string[] = [];

  // Tracking-mode mix
  if (fullDetailSessions > 0 && tallySessions > 0) {
    obs.push(
      `Of the ${totalSessions} session${totalSessions === 1 ? "" : "s"} this season, ${fullDetailSessions} were tracked match-by-match and ${tallySessions} were tally-only. The phones got tired before the legs did.`
    );
  }

  // Scored-match shape (only if we have scored matches)
  if (snap.scored_match_count > 0) {
    const closePct = Math.round((100 * snap.close_matches) / snap.scored_match_count);
    obs.push(
      `**${closePct}%** of fully-scored matches (${snap.close_matches} of ${snap.scored_match_count}) finished within 2 points — exactly the kind of ratio that justifies driving out to Snoqualmie on a Monday night.`
    );
    obs.push(
      `Average match margin landed at **${snap.avg_margin} points**. Translation: most games were competitive enough to keep you honest, but not so close that the loser could blame the wind.`
    );
  }

  // Most-played pairing
  if (mostPlayedPair && mostPlayedPair.games >= 4) {
    obs.push(
      `**${mostPlayedPair.player1} & ${mostPlayedPair.player2}** ended up on the same side of the net **${mostPlayedPair.games} times** — more than any other duo. At some point that stops being a coincidence and starts being a relationship.`
    );
  }

  // Strongest vs cursed pair
  if (bestPairs[0] && worstPairs[0] && bestPairs[0] !== worstPairs[0]) {
    const bp = bestPairs[0]; const wp = worstPairs[0];
    obs.push(
      `The strongest frequent duo (**${bp.player1} & ${bp.player2}**, ${pct(bp.win_pct)}) and the unluckiest frequent duo (**${wp.player1} & ${wp.player2}**, ${pct(wp.win_pct)}) are separated by ${Math.round(bp.win_pct - wp.win_pct)} percentage points. Pick your partner like your win rate depends on it. It does.`
    );
  }

  // Clean sweep pair(s)
  if (cleanPairs.length > 0) {
    const cp = cleanPairs[0];
    obs.push(
      `**${cp.player1} & ${cp.player2}** went **${cp.wins}-${cp.losses}** as a pair this season. Nobody beat them in their partnership; whether the rest of you should be more worried or more inspired is left as an exercise.`
    );
  }

  // Winless pair(s)
  if (winlessPairs.length > 0) {
    const lp = winlessPairs[0];
    obs.push(
      `Spare a thought for **${lp.player1} & ${lp.player2}** — ${lp.wins}-${lp.losses} together. A perfect 0% win rate is, in its own way, a kind of consistency.`
    );
  }

  // Underdog crew
  const underdogs = players.filter((p) => p.skill_level <= 2 && p.games >= MIN_GAMES_FOR_RATE && p.win_pct >= 55).sort((a, b) => b.win_pct - a.win_pct);
  if (underdogs[0]) {
    const names = underdogs.slice(0, 3).map((p) => `**${p.name}** (level ${p.skill_level}, ${pct(p.win_pct)})`).join(", ");
    obs.push(
      `The "I am not the skill level you think I am" crew: ${names}. Note to the seeding committee — please review.`
    );
  }

  // Underrated big-game players
  const slumpers = players.filter((p) => p.skill_level >= 4 && p.games >= MIN_GAMES_FOR_RATE && p.win_pct <= 50).sort((a, b) => a.win_pct - b.win_pct);
  if (slumpers[0]) {
    const names = slumpers.slice(0, 3).map((p) => `**${p.name}** (level ${p.skill_level}, ${pct(p.win_pct)})`).join(", ");
    obs.push(
      `The "I will simply pretend the rating doesn't exist" club: ${names}. Sometimes the level-${slumpers[0].skill_level} stars draw a tough rotation; sometimes badminton is rude. Both are true.`
    );
  }

  // Wins per session champion
  const valueRanked = players
    .filter((p) => p.sessions_attended >= Math.max(3, Math.floor(totalSessions / 2)))
    .map((p) => ({ p, wps: p.wins / p.sessions_attended }))
    .sort((a, b) => b.wps - a.wps);
  if (valueRanked[0]) {
    const v = valueRanked[0];
    obs.push(
      `**Wins-per-session champion**: **${v.p.name}** averaged **${v.wps.toFixed(1)} wins every time** they showed up. If you carpool, sit on their side of the net.`
    );
  }

  // Most rating change in absolute terms (collective stat)
  if (withDelta.length > 0) {
    const mostMovement = [...withDelta].sort((a, b) => Math.abs(b.ubr_delta) - Math.abs(a.ubr_delta))[0];
    if (mostMovement) {
      const direction = mostMovement.ubr_delta > 0 ? "up" : "down";
      obs.push(
        `The biggest UBR shake-up belongs to **${mostMovement.name}**: ${Math.abs(mostMovement.ubr_delta)} points ${direction} from start of season. Whatever you changed — keep doing it. Or stop doing it. Depending.`
      );
    }
  }

  // UBR risers as a cohort
  if (climbers.length >= 3) {
    const c1 = climbers[0], c2 = climbers[1], c3 = climbers[2];
    obs.push(
      `Three players quietly outgrew their initial rating: **${c1.name}** (${fmtSigned(c1.ubr_delta)}), **${c2.name}** (${fmtSigned(c2.ubr_delta)}), and **${c3.name}** (${fmtSigned(c3.ubr_delta)}). The skill-level form has hereby been notified.`
    );
  }

  // UBR sliders as a cohort
  if (sliders.length >= 2 && sliders[0].ubr_delta < 0 && sliders[1].ubr_delta < 0) {
    obs.push(
      `Two high-skill players got a polite shake from the rating system: **${sliders[0].name}** (${fmtSigned(sliders[0].ubr_delta)}) and **${sliders[1].name}** (${fmtSigned(sliders[1].ubr_delta)}). Some of that is small sample size. Some of it is the universe.`
    );
  }

  // Tally mode — how many person-games went through whiteboard?
  if (tallySessions > 0 && fullDetailSessions > 0) {
    const tallyPersonGames = players.reduce((s, p) => s + (p.games - 0), 0); // we don't separate by mode per-player, but we can describe the mix qualitatively
    void tallyPersonGames;
    obs.push(
      `On whiteboard-only nights, the recorder gets a workout too — every match counted has to come off the wall by hand. That ${tallySessions} of ${totalSessions} sessions ran on the whiteboard means a lot of arm cardio happened off the court.`
    );
  }

  // Gender split
  if (female.length > 0 && male.length > 0) {
    const femGames = female.reduce((s, p) => s + p.games, 0);
    const maleGames = male.reduce((s, p) => s + p.games, 0);
    const total = femGames + maleGames;
    if (total > 0) {
      const topFem = [...female].filter((p) => p.games >= MIN_GAMES_FOR_RATE).sort((a, b) => b.win_pct - a.win_pct)[0];
      obs.push(
        `Court time was **${Math.round((100 * maleGames) / total)}% / ${Math.round((100 * femGames) / total)}%** men vs women across ${male.length} men and ${female.length} women on roster.` +
        (topFem ? ` Top women's win rate: **${topFem.name}** at ${pct(topFem.win_pct)} over ${topFem.games} games — the men's leaderboard is invited to hold her water bottle.` : "")
      );
    }
  }

  // Best mixed-skill partnership (s1 != s2)
  const mixedPairs = bestPairs.filter((p) => p.s1 !== p.s2 && p.games >= 3);
  if (mixedPairs[0]) {
    const mp = mixedPairs[0];
    obs.push(
      `**${mp.player1} (lvl ${mp.s1}) & ${mp.player2} (lvl ${mp.s2})** were the strongest cross-skill partnership at ${pct(mp.win_pct)} over ${mp.games} games. Different levels, same vibe.`
    );
  }

  // Players who only had wins recorded (showed up, never lost a tracked game)
  const undefeated = players.filter((p) => p.games >= 6 && p.losses === 0);
  if (undefeated[0]) {
    const u = undefeated[0];
    obs.push(
      `**${u.name}** finished the regular season **${u.wins}–${u.losses}**. Mathematicians call that a perfect record. Sportscasters call it terrifying.`
    );
  }

  // First-time / lower-game players
  const lowGames = players.filter((p) => p.games > 0 && p.games < Math.max(5, Math.floor(MIN_GAMES_FOR_RATE / 4))).length;
  if (lowGames > 0) {
    obs.push(
      `**${lowGames}** player${lowGames === 1 ? "" : "s"} appeared on court for only a handful of games this season — drop-ins, debuts, or comeback nights. Each one of those is somebody who almost stayed on the couch and decided not to. Good.`
    );
  }

  // Roster breadth
  obs.push(
    `**${totalDistinct}** unique humans took the court at least once this season. Snoqualmie remains, statistically, the friendliest place in the Pacific Northwest to lose a winnable rally.`
  );

  // Sekhar disclaimer — a small wink for context
  if (AWARD_EXCLUDE_NAMES.size > 0) {
    const excluded = players.find((p) => AWARD_EXCLUDE_NAMES.has(p.name.toLowerCase()));
    if (excluded) {
      obs.push(
        `For the record, **${excluded.name}** finished ${excluded.wins}-${excluded.losses} across ${excluded.games} games (${pct(excluded.win_pct)}). He has politely declined to be considered for awards. We respect that, while also noting the numbers in case the rest of you want to know what you're chasing.`
      );
    }
  }

  // Emit observations as a markdown list.
  for (const line of obs) lines.push(`- ${line}`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(`_Compiled ${formatLong(generatedAt)} from match data through ${formatDate(snap.lock_date ?? snap.end_date)}. Stats locked, drama unlocked._`);
  lines.push("");
  return { title, content_md: lines.join("\n") };
}

function formatDate(s: string): string {
  const d = new Date(s + (s.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatLong(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
