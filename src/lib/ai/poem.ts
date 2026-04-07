import Anthropic from "@anthropic-ai/sdk";
import type { PlayerPoemContext } from "@/lib/db/players";

const client = new Anthropic();

export async function generatePlayerPoem(
  name: string,
  context: PlayerPoemContext
): Promise<string> {
  const { wins, losses, recentSessions, topPartner, onlyTestSessions } = context;
  const totalMatches = wins + losses;

  let prompt: string;

  if (onlyTestSessions) {
    prompt = `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name} who has only ever played in test sessions — they're more of a quality-assurance expert than an actual player. Make it playful and self-aware, as if they're a professional app tester who somehow ended up on a badminton court. Keep it warm and friendly, not insulting. Use their name. Return only the poem, no title or preamble.`;
  } else {
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
      lines.push(`Favourite doubles partner: ${topPartner}`);
    }

    const context_str = lines.join(". ");
    prompt = `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name}. Context: ${context_str}. Use their name in the poem. Reference something specific from their stats or partner if interesting. Keep it warm, witty, and rhyming — nothing controversial, insulting, or edgy. Return only the poem, no title or preamble.`;
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}
