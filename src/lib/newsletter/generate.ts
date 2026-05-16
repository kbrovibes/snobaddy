import type { PlayerRow, PairRow, SeasonStatsSnapshot } from "./stats";

interface GenerateOptions {
  extraContext?: string | null;
  generatedAt?: Date;
}

function pct(n: number) { return `${n.toFixed(1)}%`; }
function fmtSigned(n: number | null | undefined) {
  if (n == null) return "n/a";
  if (n > 0) return `+${n}`;
  return `${n}`;
}

const SKILL_NAMES: Record<number, string> = {
  1: "level-1",
  2: "level-2",
  3: "level-3",
  4: "level-4",
  5: "level-5",
};

// Mean win-rate for a player's skill bucket, used to derive "outperformance".
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
  const totalPersonGames = snap.total_player_outcomes;
  const totalDistinct = snap.unique_players;

  // Sorted views
  const byGames = [...players].sort((a, b) => b.games - a.games);
  const byAttendance = [...players].sort((a, b) => b.sessions_attended - a.sessions_attended || a.name.localeCompare(b.name));
  const byWins = [...players].sort((a, b) => b.wins - a.wins);

  const MIN_GAMES_FOR_RATE = Math.max(10, Math.ceil(totalSessions * 1.5));
  const qualifiedForRate = players.filter((p) => p.games >= MIN_GAMES_FOR_RATE);
  const byWinPct = [...qualifiedForRate].sort((a, b) => b.win_pct - a.win_pct || b.games - a.games);
  const byWinPctDesc = [...qualifiedForRate].sort((a, b) => a.win_pct - b.win_pct || b.games - a.games);

  // UBR movers
  const withDelta = players.filter((p) => p.ubr_delta != null) as (PlayerRow & { ubr_delta: number })[];
  const climbers = [...withDelta].sort((a, b) => b.ubr_delta - a.ubr_delta).slice(0, 5);
  const sliders = [...withDelta].sort((a, b) => a.ubr_delta - b.ubr_delta).slice(0, 5);

  // Pairs
  const pairs = snap.pairs;
  const mostPlayedPair = pairs[0];
  const bestPairs = [...pairs].filter((p) => p.games >= 3).sort((a, b) => b.win_pct - a.win_pct || b.games - a.games);
  const worstPairs = [...pairs].filter((p) => p.games >= 3).sort((a, b) => a.win_pct - b.win_pct || b.games - a.games);

  // Skill-bucket averages for the "outperformance" math section
  const bucketAvg = bucketAverages(players, MIN_GAMES_FOR_RATE);
  const overperformers = qualifiedForRate
    .map((p) => ({ p, expected: bucketAvg.get(p.skill_level) ?? 50, delta: p.win_pct - (bucketAvg.get(p.skill_level) ?? 50) }))
    .sort((a, b) => b.delta - a.delta);

  // Gender split
  const female = players.filter((p) => p.gender === "female");
  const male = players.filter((p) => p.gender === "male");

  // Compose markdown
  const lines: string[] = [];
  const dateRange = `${formatDate(snap.start_date)} – ${formatDate(snap.lock_date ?? snap.end_date)}`;

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_${dateRange} · ${totalSessions} session${totalSessions === 1 ? "" : "s"} of birdie-induced bedlam_`);
  lines.push("");

  // ── Intro ──────────────────────────────────────────────────────────
  lines.push("## A Brief Word From The Whiteboard");
  lines.push("");
  if (opts.extraContext && opts.extraContext.trim().length > 0) {
    lines.push(opts.extraContext.trim());
    lines.push("");
  }
  const modeBreakdown = (fullDetailSessions > 0 || tallySessions > 0)
    ? ` ${fullDetailSessions} of those night${fullDetailSessions === 1 ? "" : "s"} ran in full-detail mode (every match logged with rosters and scores) and ${tallySessions} ran in whiteboard tally mode (per-player W/L only).`
    : "";
  lines.push(
    `${totalSessions} session${totalSessions === 1 ? "" : "s"} on court, ${totalDistinct} unique humans, and **${totalPersonGames}** individual W/L outcomes logged across the two Snoqualmie courts.${modeBreakdown}`
  );
  lines.push("");
  if (snap.scored_match_count > 0) {
    lines.push(
      `Of the ${snap.scored_match_count} matches recorded with full scores, the average margin was **${snap.avg_margin ?? "—"}** points. ` +
      `**${snap.close_matches}** ended within 2 points (nail-biters), ${snap.blowouts} ended by 10+ (certifiable thrashings), and ${snap.bagels} ended 21-0. ` +
      `Nobody got bageled, which says good things about all of you and slightly disappointing things about anyone hoping for chaos.`
    );
    lines.push("");
  }

  // ── The Badminton Nut ──────────────────────────────────────────────
  lines.push("## 🥜 The Badminton Nut");
  lines.push("");
  lines.push(
    "_Devoted, unreasonable, slightly unhinged. The people who show up every single time the doors open._"
  );
  lines.push("");
  if (snap.perfect_attendance.length > 0) {
    const names = snap.perfect_attendance.map((p) => `**${p.name}**`).join(", ");
    const verb = snap.perfect_attendance.length === 1 ? "is" : "are";
    lines.push(
      `Perfect attendance club this season: ${names}. ${verb === "is" ? "This person" : "These people"} attended **all ${totalSessions} sessions**. Their families have begun mailing them photos to remember what they look like.`
    );
    lines.push("");
  }
  lines.push("### Most games played");
  lines.push("");
  lines.push("| Rank | Player | Games | W–L | Win % |");
  lines.push("|---:|---|---:|:---:|---:|");
  byGames.slice(0, 7).forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.name} | ${p.games} | ${p.wins}–${p.losses} | ${pct(p.win_pct)} |`);
  });
  lines.push("");
  const topGrinder = byGames[0];
  if (topGrinder) {
    const second = byGames[1];
    lines.push(
      `**${topGrinder.name}** logged **${topGrinder.games}** scored games — ` +
        (second ? `that's ${topGrinder.games - second.games} more than ${second.name}, the next closest victim of the addiction. ` : "") +
        `If badminton were a paycheck, ${topGrinder.name.split(" ")[0]} would be filing overtime.`
    );
    lines.push("");
  }

  // ── The Nutcracker Awards ──────────────────────────────────────────
  lines.push("## 🏆 The Nutcracker Awards");
  lines.push("");
  lines.push("_Highly arbitrary honors, awarded with great seriousness._");
  lines.push("");

  if (byWins[0]) {
    const w = byWins[0];
    lines.push(`**The Most Wins Trophy** → **${w.name}** (${w.wins} W). The scoreboard groaned audibly every time ${w.name.split(" ")[0]} took the court.`);
    lines.push("");
  }

  if (byWinPct[0] && byWinPct[0].games >= MIN_GAMES_FOR_RATE) {
    const top = byWinPct[0];
    lines.push(`**The Coldest Stat Line** → **${top.name}** at **${pct(top.win_pct)}** over ${top.games} games. ${top.name.split(" ")[0]} doesn't win matches — ${top.name.split(" ")[0]} confiscates them.`);
    lines.push("");
  }

  if (bestPairs[0]) {
    const bp = bestPairs[0];
    lines.push(`**Best Duo (3+ games)** → **${bp.player1} & ${bp.player2}** at ${bp.wins}-${bp.losses} (${pct(bp.win_pct)}). Pair them again at your own risk; entire courts have been emotionally damaged.`);
    lines.push("");
  }

  if (worstPairs[0] && worstPairs[0].win_pct < (bestPairs[0]?.win_pct ?? 100)) {
    const wp = worstPairs[0];
    lines.push(`**The Cursed Side of the Net** → **${wp.player1} & ${wp.player2}** at ${wp.wins}-${wp.losses} (${pct(wp.win_pct)}). Statistically speaking, their partnership is a haunted house. We salute them anyway.`);
    lines.push("");
  }

  if (mostPlayedPair) {
    lines.push(`**The Telepathy Award** → **${mostPlayedPair.player1} & ${mostPlayedPair.player2}** — partnered up **${mostPlayedPair.games} times** this season (${mostPlayedPair.wins}-${mostPlayedPair.losses}). At this point they are basically one person sharing two rackets.`);
    lines.push("");
  }

  if (climbers[0]) {
    const c = climbers[0];
    lines.push(`**The Snoqualmie Surge (biggest UBR climb)** → **${c.name}** with **${fmtSigned(c.ubr_delta)}** rating points. The skill-level form may need to be re-opened.`);
    lines.push("");
  }
  if (sliders[0] && sliders[0].ubr_delta < 0) {
    const s = sliders[0];
    lines.push(`**The Humility Plaque (biggest UBR slide)** → **${s.name}** at **${fmtSigned(s.ubr_delta)}**. Don't worry — falling off a high ledge just means you started up there.`);
    lines.push("");
  }

  // ── Efficiency math ───────────────────────────────────────────────
  lines.push("## 📐 The Math Corner: Who Was *Actually* Efficient?");
  lines.push("");
  lines.push(
    `Raw wins reward whoever showed up the most. To find the truly **efficient** players, we measured each person's win rate against the average win rate of *everyone at the same skill level*. ` +
    `If you out-performed your bucket, you're a problem. If you lagged it, the rating system has notes.`
  );
  lines.push("");
  lines.push("**Average win rate by skill bucket this season** (qualified players only):");
  lines.push("");
  lines.push("| Skill | Avg win % | Qualified players |");
  lines.push("|:---:|---:|---:|");
  const skillsPresent = [...new Set(qualifiedForRate.map((p) => p.skill_level))].sort();
  for (const s of skillsPresent) {
    const inBucket = qualifiedForRate.filter((p) => p.skill_level === s);
    const avg = bucketAvg.get(s) ?? 0;
    lines.push(`| ${SKILL_NAMES[s] ?? s} | ${avg.toFixed(1)}% | ${inBucket.length} |`);
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
    const star = overperformers[0];
    if (star && star.delta > 0) {
      lines.push(
        `Translation: a level-${star.p.skill_level} player would normally win about ${star.expected.toFixed(0)}% of their matches in this room. ` +
        `${star.p.name} won **${pct(star.p.win_pct)}**. That's a ${(star.delta).toFixed(1)}-point overshoot, which in scientific terms means *${star.p.name.split(" ")[0]} is misclassified and we should all be slightly nervous.*`
      );
      lines.push("");
    }
  }
  if (overperformers.length > 5) {
    const under = overperformers.filter((o) => o.delta < 0).slice(-3).reverse();
    if (under.length > 0) {
      lines.push("### And the rating system would like a quiet word with…");
      lines.push("");
      under.forEach(({ p, expected, delta }) => {
        lines.push(`- **${p.name}** (level ${p.skill_level}): ${pct(p.win_pct)} vs. ${expected.toFixed(1)}% bucket average (**${fmtSigned(Math.round(delta * 10) / 10)}pp**). The Tuesday-morning recovery is going to take some hot tea.`);
      });
      lines.push("");
    }
  }

  // UBR delta leaderboard
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

  // ── Fun Observations ──────────────────────────────────────────────
  lines.push("## 🔍 Fun Observations (the part you'll actually screenshot)");
  lines.push("");

  // Observation: most lopsided & most balanced
  if (snap.close_matches > 0 || snap.blowouts > 0) {
    lines.push(
      `- Out of ${snap.scored_match_count} scored matches, **${snap.close_matches}** ended within 2 points and **${snap.blowouts}** ended by 10+ points. ` +
      `So roughly ${Math.round((100 * snap.close_matches) / Math.max(1, snap.scored_match_count))}% of matches were too close to call until the last serve — exactly the percentage that justifies driving out on a Monday night.`
    );
  }

  // Observation: most-played-against pairing
  if (mostPlayedPair && mostPlayedPair.games >= 5) {
    lines.push(
      `- **${mostPlayedPair.player1} & ${mostPlayedPair.player2}** showed up on the same side of the net **${mostPlayedPair.games} times**, more than any other duo. ` +
      `Anthropologists call this "tribal bonding." Snobaddy calls it "we ran out of subs."`
    );
  }

  // Observation: dominant pair vs cursed pair
  if (bestPairs[0] && worstPairs[0] && bestPairs[0] !== worstPairs[0]) {
    const bp = bestPairs[0]; const wp = worstPairs[0];
    lines.push(
      `- The same partner can be your fortune or your downfall. The strongest duo (**${bp.player1} & ${bp.player2}**, ${pct(bp.win_pct)}) and the unluckiest duo (**${wp.player1} & ${wp.player2}**, ${pct(wp.win_pct)}) are separated by ${Math.round(bp.win_pct - wp.win_pct)} percentage points — which is a polite way of saying *check who you're rotating with.*`
    );
  }

  // Observation: gender split
  if (female.length > 0 && male.length > 0) {
    const femGames = female.reduce((s, p) => s + p.games, 0);
    const maleGames = male.reduce((s, p) => s + p.games, 0);
    const total = femGames + maleGames;
    if (total > 0) {
      lines.push(
        `- Court time was ${Math.round((100 * maleGames) / total)}% played by men and ${Math.round((100 * femGames) / total)}% played by women, across ${male.length} male and ${female.length} female players. ` +
        `The top women's win-rate was held by **${[...female].sort((a, b) => b.win_pct - a.win_pct).filter((p) => p.games >= MIN_GAMES_FOR_RATE)[0]?.name ?? "—"}**, who quietly informed the men's leaderboard that it should hold her water bottle.`
      );
    }
  }

  // Observation: highest "value per session" — wins per session attended
  const valueRanked = players
    .filter((p) => p.sessions_attended >= Math.max(3, Math.floor(totalSessions / 2)))
    .map((p) => ({ p, wps: p.wins / p.sessions_attended }))
    .sort((a, b) => b.wps - a.wps);
  if (valueRanked[0]) {
    const v = valueRanked[0];
    lines.push(
      `- **Wins per session** champion: **${v.p.name}** averaged **${v.wps.toFixed(1)} wins every time** they showed up. ` +
      `If you carpool, sit on their side of the net.`
    );
  }

  // Observation: skill underdogs that won often
  const underdogs = players
    .filter((p) => p.skill_level <= 2 && p.games >= MIN_GAMES_FOR_RATE && p.win_pct >= 55)
    .sort((a, b) => b.win_pct - a.win_pct);
  if (underdogs[0]) {
    const names = underdogs.slice(0, 3).map((p) => `**${p.name}** (level ${p.skill_level}, ${pct(p.win_pct)})`).join(", ");
    lines.push(
      `- The "I am not the skill level you think I am" crew: ${names}. ` +
      `Note to the seeding committee: please review.`
    );
  }

  // Observation: skill stars that did NOT carry hard
  const slumpers = players
    .filter((p) => p.skill_level >= 4 && p.games >= MIN_GAMES_FOR_RATE && p.win_pct <= 50)
    .sort((a, b) => a.win_pct - b.win_pct);
  if (slumpers[0]) {
    const names = slumpers.slice(0, 3).map((p) => `**${p.name}** (level ${p.skill_level}, ${pct(p.win_pct)})`).join(", ");
    lines.push(
      `- The "I will simply pretend the rating doesn't exist" club: ${names}. ` +
      `Sometimes the level-${slumpers[0].skill_level} stars draw a tough rotation; sometimes badminton is rude. Both are true.`
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`_Generated ${formatLong(generatedAt)} from match data through ${formatDate(snap.lock_date ?? snap.end_date)}. Stats locked, drama unlocked._`);
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
