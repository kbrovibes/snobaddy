import { AwardCard } from "@/components/SessionHighlights";
import { shortName } from "@/lib/display-name";
import type { TallyEntry } from "@/lib/db/tally";

function colSpanFor(total: number, index: number): string {
  if (total === 1) return "col-span-6";
  if (total === 2) return "col-span-3";
  return "col-span-2"; // 3 cards → 3 × col-span-2 = full row
}

export default function TallyHighlights({
  entries,
  nameMap,
}: {
  entries: TallyEntry[];
  nameMap: Map<string, string>;
}) {
  if (entries.length < 2) return null;

  // Slayer — most wins
  const maxWins = Math.max(...entries.map((e) => e.wins));
  const slayerNames = entries.filter((e) => e.wins === maxWins).map((e) => e.player_name);

  // Unstoppable — most matches played (wins + losses)
  const maxMatches = Math.max(...entries.map((e) => e.wins + e.losses));
  const unstoppableNames = entries
    .filter((e) => e.wins + e.losses === maxMatches)
    .map((e) => e.player_name);

  // Untouchable — best win rate, min 3 matches
  const eligible = entries.filter((e) => e.wins + e.losses >= 3);
  const untouchableNames: string[] = [];
  let bestWinPct = 0;
  if (eligible.length > 0) {
    bestWinPct = Math.max(...eligible.map((e) => e.wins / (e.wins + e.losses)));
    eligible
      .filter((e) => Math.abs(e.wins / (e.wins + e.losses) - bestWinPct) < 0.0001)
      .forEach((e) => untouchableNames.push(e.player_name));
  }

  type Card = { emoji: string; title: string; description: string; name: string; stat: string };
  const cards: Card[] = [];

  if (maxWins > 0) {
    cards.push({
      emoji: "⚔️",
      title: "The Slayer",
      description: "Most wins tonight",
      name: slayerNames.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${maxWins} win${maxWins !== 1 ? "s" : ""}`,
    });
  }

  cards.push({
    emoji: "🚀",
    title: "The Unstoppable",
    description: "Most matches played",
    name: unstoppableNames.map((n) => shortName(n, nameMap)).join(", "),
    stat: `${maxMatches} matches`,
  });

  if (untouchableNames.length > 0) {
    cards.push({
      emoji: "🧊",
      title: "The Untouchable",
      description: "Best win rate (min 3 matches)",
      name: untouchableNames.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${Math.round(bestWinPct * 100)}% win rate`,
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Session Awards
      </h2>
      <div className="grid grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <AwardCard key={card.title} {...card} colSpan={colSpanFor(cards.length, i)} />
        ))}
      </div>
    </div>
  );
}
