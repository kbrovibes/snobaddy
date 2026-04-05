import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generatePlayerPoem(
  name: string,
  wins: number,
  losses: number
): Promise<string> {
  const matches = wins + losses;
  const record =
    matches === 0
      ? "brand new to the court with no matches yet"
      : `${wins} win${wins !== 1 ? "s" : ""} and ${losses} loss${losses !== 1 ? "es" : ""} in ${matches} match${matches !== 1 ? "es" : ""}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: `Write a funny, light-hearted 2–3 line poem about a badminton player named ${name} who has ${record}. Use their name in the poem. Make it witty and rhyme. Return only the poem, no title or preamble.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}
