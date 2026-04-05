/**
 * Backfill player poems for all players with >= 5 matches.
 * Run with: node --env-file=.env.local scripts/backfill-poems.mjs
 */

import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIN_MATCHES = 5;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const anthropic = new Anthropic();
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers });
  return res.json();
}

async function sbUpsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Upsert failed: ${await res.text()}`);
}

async function buildPoemContext(playerId, matches) {
  const mine = matches.filter(
    (m) =>
      m.team1_player1_id === playerId ||
      m.team1_player2_id === playerId ||
      m.team2_player1_id === playerId ||
      m.team2_player2_id === playerId
  );

  let wins = 0, losses = 0;
  const partnerCount = new Map();
  const sessionMap = new Map();

  for (const m of mine) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    if (won) wins++; else losses++;

    // Partner name
    let partner;
    if (onTeam1) {
      partner = m.team1_player1_id === playerId ? m.t1p2?.name : m.t1p1?.name;
    } else {
      partner = m.team2_player1_id === playerId ? m.t2p2?.name : m.t2p1?.name;
    }
    if (partner) partnerCount.set(partner, (partnerCount.get(partner) ?? 0) + 1);

    // Session breakdown
    const date = m.sessions?.date ?? "unknown";
    const entry = sessionMap.get(m.session_id) ?? { date, wins: 0, losses: 0 };
    if (won) entry.wins++; else entry.losses++;
    sessionMap.set(m.session_id, entry);
  }

  const recentSessions = Array.from(sessionMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const topPartner = partnerCount.size > 0
    ? Array.from(partnerCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return { wins, losses, recentSessions, topPartner };
}

async function generatePoem(name, context) {
  const { wins, losses, recentSessions, topPartner } = context;
  const totalMatches = wins + losses;

  const lines = [
    `${name} has ${wins} win${wins !== 1 ? "s" : ""} and ${losses} loss${losses !== 1 ? "es" : ""} across ${totalMatches} matches`,
  ];
  if (recentSessions.length > 0) {
    lines.push(`Recent sessions: ${recentSessions.map((s) => `${s.wins}W-${s.losses}L on ${s.date}`).join(", ")}`);
  }
  if (topPartner) lines.push(`Favourite partner: ${topPartner}`);

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name}. Context: ${lines.join(". ")}. Use their name. Reference something specific from their stats or partner if interesting. Make it witty and rhyme. Return only the poem, no title or preamble.`,
      },
    ],
  });

  return msg.content[0].text.trim();
}

async function main() {
  console.log("Fetching players...");
  const players = await sbGet(
    "/players?select=id,name&onboarding_complete=eq.true&order=name"
  );

  console.log("Fetching all matches...");
  const matches = await sbGet(
    `/matches?select=session_id,winning_team,team1_player1_id,team1_player2_id,team2_player1_id,team2_player2_id,sessions(date),t1p1:team1_player1_id(name),t1p2:team1_player2_id(name),t2p1:team2_player1_id(name),t2p2:team2_player2_id(name)`
  );

  console.log("Fetching existing poems...");
  const existingPoems = await sbGet("/player_poems?select=player_id,matches_at_generation");
  const poemMap = new Map(existingPoems.map((p) => [p.player_id, p.matches_at_generation]));

  // Count matches per player
  const matchCount = new Map();
  for (const m of matches) {
    for (const pid of [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]) {
      matchCount.set(pid, (matchCount.get(pid) ?? 0) + 1);
    }
  }

  const toGenerate = players.filter((p) => {
    const count = matchCount.get(p.id) ?? 0;
    if (count < MIN_MATCHES) return false;
    const existing = poemMap.get(p.id);
    // Skip if already has poem and match count hasn't changed by 3+
    if (existing !== undefined && Math.abs(count - existing) < 3) return false;
    return true;
  });

  console.log(`\nGenerating poems for ${toGenerate.length} players (≥${MIN_MATCHES} matches, missing or stale):\n`);

  for (const player of toGenerate) {
    const context = await buildPoemContext(player.id, matches);
    const totalMatches = context.wins + context.losses;
    process.stdout.write(`  ${player.name} (${totalMatches} matches)... `);
    try {
      const poem = await generatePoem(player.name, context);
      await sbUpsert("player_poems", {
        player_id: player.id,
        poem,
        matches_at_generation: totalMatches,
        created_at: new Date().toISOString(),
      });
      console.log("✓");
      console.log(`    "${poem.split("\n")[0]}..."`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
