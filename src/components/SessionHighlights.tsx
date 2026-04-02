import { SessionHighlights as Highlights } from "@/lib/db/matches";

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

interface AwardCardProps {
  emoji: string;
  title: string;
  description: string;
  name: string;
  stat: string;
}

function AwardCard({ emoji, title, description, name, stat, wide }: AwardCardProps & { wide?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-col items-center gap-1 text-center${wide ? " col-span-2" : ""}`}>
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-gray-700 leading-tight">{title}</span>
      <span className="text-xs text-gray-400 leading-tight">{description}</span>
      <span className="text-sm font-bold text-gray-900 leading-tight mt-1">{name}</span>
      <span className="text-xs text-gray-400">{stat}</span>
    </div>
  );
}

export default function SessionHighlights({ highlights }: { highlights: Highlights }) {
  const { sultan, ironShuttle, untouchable, cannon, noMercy } = highlights;

  const cards: AwardCardProps[] = [];

  if (sultan) {
    cards.push({
      emoji: "👑",
      title: "The Sultan",
      description: "Most wins tonight",
      name: getFirstName(sultan.name),
      stat: `${sultan.wins} win${sultan.wins !== 1 ? "s" : ""}`,
    });
  }

  if (ironShuttle) {
    cards.push({
      emoji: "🦾",
      title: "Iron Shuttle",
      description: "Most matches played",
      name: getFirstName(ironShuttle.name),
      stat: `${ironShuttle.matches} matches`,
    });
  }

  if (untouchable) {
    cards.push({
      emoji: "🧊",
      title: "The Untouchable",
      description: "Best win rate (min 3 matches)",
      name: getFirstName(untouchable.name),
      stat: `${untouchable.winPct}% win rate`,
    });
  }

  if (cannon) {
    cards.push({
      emoji: "💥",
      title: "The Cannon",
      description: "Most points scored",
      name: getFirstName(cannon.name),
      stat: `${cannon.points} pts`,
    });
  }

  if (noMercy) {
    cards.push({
      emoji: "😤",
      title: "No Mercy",
      description: "Biggest winning margin",
      name: noMercy.team.map(getFirstName).join(" & "),
      stat: `${noMercy.score} (gap ${noMercy.margin})`,
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Session Awards
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <AwardCard key={card.title} {...card} wide={cards.length % 2 === 1 && i === cards.length - 1} />
        ))}
      </div>
    </div>
  );
}
