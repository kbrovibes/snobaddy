/**
 * One-off script: regenerate all player poems.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/regenerate-poems.mjs
 *
 * Reads player context from Supabase (non-test sessions only, includes tally data).
 * Detects test-only players and generates a funny "professional tester" poem for them.
 * Upserts into player_poems table.
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// --- Load env from .env.local if not already set ---
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
  }
} catch {
  // .env.local not found, rely on environment
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — run as: ANTHROPIC_API_KEY=sk-ant-... node scripts/regenerate-poems.mjs");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- Fetch active (non-deleted, onboarded) players ---
async function getPlayers() {
  const { data, error } = await db
    .from("players")
    .select("id, name, gender")
    .eq("onboarding_complete", true)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// --- Build poem context for a player (mirrors getPlayerPoemContext in players.ts) ---
async function getPoemContext(playerId) {
  const [{ data: allMatchData }, { data: realMatchData }, { data: tallyData }] =
    await Promise.all([
      db
        .from("matches")
        .select("session_id, sessions(is_test_session)")
        .or(
          `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`
        ),
      db
        .from("matches")
        .select(
          `winning_team, session_id,
           team1_player1_id, team1_player2_id,
           team2_player1_id, team2_player2_id,
           sessions!inner(date, is_test_session),
           t1p1:team1_player1_id(name),
           t1p2:team1_player2_id(name),
           t2p1:team2_player1_id(name),
           t2p2:team2_player2_id(name)`
        )
        .or(
          `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`
        )
        .eq("sessions.is_test_session", false),
      db
        .from("session_tally")
        .select("session_id, wins, losses, sessions(date, is_test_session)")
        .eq("player_id", playerId),
    ]);

  const hasAnyData = (allMatchData ?? []).length > 0 || (tallyData ?? []).length > 0;
  const hasRealMatchData = (realMatchData ?? []).length > 0;
  const hasRealTallyData = (tallyData ?? []).some(
    (t) => !t.sessions?.is_test_session
  );
  const onlyTestSessions = hasAnyData && !hasRealMatchData && !hasRealTallyData;

  let wins = 0;
  let losses = 0;
  const partnerCount = new Map();
  const sessionMap = new Map();

  for (const m of realMatchData ?? []) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = (onTeam1 && m.winning_team === 1) || (!onTeam1 && m.winning_team === 2);
    if (won) wins++; else losses++;

    const t1p1 = m.t1p1?.name;
    const t1p2 = m.t1p2?.name;
    const t2p1 = m.t2p1?.name;
    const t2p2 = m.t2p2?.name;
    const partner = onTeam1
      ? (m.team1_player1_id === playerId ? t1p2 : t1p1)
      : (m.team2_player1_id === playerId ? t2p2 : t2p1);
    if (partner) partnerCount.set(partner, (partnerCount.get(partner) ?? 0) + 1);

    const sessionDate = m.sessions?.date;
    if (sessionDate) {
      const entry = sessionMap.get(m.session_id) ?? { date: sessionDate, wins: 0, losses: 0 };
      if (won) entry.wins++; else entry.losses++;
      sessionMap.set(m.session_id, entry);
    }
  }

  for (const t of tallyData ?? []) {
    if (t.sessions?.is_test_session) continue;
    if (t.wins === 0 && t.losses === 0) continue;
    wins += t.wins;
    losses += t.losses;
    if (!sessionMap.has(t.session_id)) {
      sessionMap.set(t.session_id, { date: t.sessions?.date, wins: t.wins, losses: t.losses });
    }
  }

  const recentSessions = Array.from(sessionMap.values())
    .filter((s) => s.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const topPartner =
    partnerCount.size > 0
      ? Array.from(partnerCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return { wins, losses, recentSessions, topPartner, onlyTestSessions };
}

// --- Generate poem via Claude ---
async function generatePoem(name, gender, context) {
  const { wins, losses, recentSessions, topPartner, onlyTestSessions } = context;
  const totalMatches = wins + losses;
  const pronounHint = gender === "female"
    ? `If you use pronouns, use she/her for ${name}.`
    : `If you use pronouns, use he/him for ${name}.`;

  let prompt;
  if (onlyTestSessions) {
    prompt = `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name} who has only ever played in test sessions — they're more of a quality-assurance expert than an actual player. Make it playful and self-aware, as if they're a professional app tester who somehow ended up on a badminton court. Keep it warm and friendly, not insulting. ${pronounHint} Use their name. Return only the poem, no title or preamble.`;
  } else {
    const lines = [];
    if (totalMatches === 0) {
      lines.push(`${name} is brand new to the court with no matches yet`);
    } else {
      lines.push(
        `${name} has ${wins} win${wins !== 1 ? "s" : ""} and ${losses} loss${losses !== 1 ? "es" : ""} across ${totalMatches} matches`
      );
    }
    if (recentSessions.length > 0) {
      const summaries = recentSessions.map((s) => `${s.wins}W-${s.losses}L on ${s.date}`);
      lines.push(`Recent sessions: ${summaries.join(", ")}`);
    }
    if (topPartner) {
      lines.push(`Favourite doubles partner: ${topPartner}`);
    }
    const contextStr = lines.join(". ");
    prompt = `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name}. Context: ${contextStr}. ${pronounHint} Use their name in the poem. Reference something specific from their stats or partner if interesting. Keep it warm, witty, and rhyming — nothing controversial, insulting, or edgy. Return only the poem, no title or preamble.`;
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}

// --- Main ---
async function main() {
  const players = await getPlayers();
  console.log(`Found ${players.length} active players\n`);

  for (const player of players) {
    process.stdout.write(`${player.name}... `);
    try {
      const context = await getPoemContext(player.id);
      const totalMatches = context.wins + context.losses;

      if (context.onlyTestSessions) {
        process.stdout.write(`[test-only] `);
      } else {
        process.stdout.write(`[${totalMatches} matches, ${context.wins}W ${context.losses}L] `);
      }

      const poem = await generatePoem(player.name, player.gender, context);

      const { error } = await db
        .from("player_poems")
        .upsert(
          {
            player_id: player.id,
            poem,
            matches_at_generation: totalMatches,
            created_at: new Date().toISOString(),
          },
          { onConflict: "player_id" }
        );

      if (error) throw error;
      console.log("✓");
      console.log(`  ${poem.replace(/\n/g, "\n  ")}\n`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
