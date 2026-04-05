import Anthropic from "@anthropic-ai/sdk";
import type { PlayerPoemContext } from "@/lib/db/players";

const client = new Anthropic();

export async function generatePlayerPoem(
  name: string,
  context: PlayerPoemContext
): Promise<string> {
  const { wins, losses, recentSessions, topPartner } = context;
  const totalMatches = wins + losses;

  const lines: string[] = [];

  if (totalMatches === 0) {
    lines.push(`${name} is brand new to the court with no matches yet`);
  } else {
    lines.push(`${name} has ${wins} win${wins !== 1 ? "s" : ""} and ${losses} loss${losses !== 1 ? "es" : ""} across ${totalMatches} matches`);
  }

  if (recentSessions.length > 0) {
    const sessionSummaries = recentSessions.map(
      (s) => `${s.wins}W-${s.losses}L on ${s.date}`
    );
    lines.push(`Recent sessions: ${sessionSummaries.join(", ")}`);
  }

  if (topPartner) {
    lines.push(`Favourite partner: ${topPartner}`);
  }

  const context_str = lines.join(". ");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name}. Context about them: ${context_str}. Use their name in the poem. Reference something specific from their stats or partner if interesting. Make it witty and rhyme. Return only the poem, no title or preamble.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}
