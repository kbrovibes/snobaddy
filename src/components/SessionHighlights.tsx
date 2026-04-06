import { SessionHighlights as Highlights } from "@/lib/db/matches";
import { shortName } from "@/lib/display-name";

interface AwardCardProps {
  emoji: string;
  title: string;
  description: string;
  name: string;
  stat: string;
}

export function AwardCard({ emoji, title, description, name, stat, colSpan }: AwardCardProps & { colSpan?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-col items-center gap-1 text-center${colSpan ? ` ${colSpan}` : ""}`}>
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-gray-700 leading-tight min-h-[2rem] flex items-center justify-center">{title}</span>
      <span className="text-xs text-gray-400 leading-tight min-h-[2rem] flex items-center justify-center">{description}</span>
      <span className="text-base font-bold text-gray-900 leading-tight mt-1">{name}</span>
      <span className="text-xs text-gray-400">{stat}</span>
    </div>
  );
}

export default function SessionHighlights({ highlights, nameMap }: { highlights: Highlights; nameMap: Map<string, string> }) {
  const { sultan, ironShuttle, untouchable, cannon, noMercy } = highlights;

  const cards: AwardCardProps[] = [];

  if (sultan) {
    cards.push({
      emoji: "⚔️",
      title: "The Slayer",
      description: "Most wins tonight",
      name: sultan.names.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${sultan.wins} win${sultan.wins !== 1 ? "s" : ""}`,
    });
  }

  if (ironShuttle) {
    cards.push({
      emoji: "🚀",
      title: "The Unstoppable",
      description: "Most matches played",
      name: ironShuttle.names.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${ironShuttle.matches} matches`,
    });
  }

  if (untouchable) {
    cards.push({
      emoji: "🧊",
      title: "The Untouchable",
      description: "Best win rate (min 3 matches)",
      name: untouchable.names.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${untouchable.winPct}% win rate`,
    });
  }

  if (cannon) {
    cards.push({
      emoji: "🎯",
      title: "The Point Collector",
      description: "Most points scored",
      name: cannon.names.map((n) => shortName(n, nameMap)).join(", "),
      stat: `${cannon.points} pts`,
    });
  }

  if (noMercy) {
    cards.push({
      emoji: "⚡",
      title: "The Ones with No Mercy",
      description: "Biggest winning margin",
      name: noMercy.team.map((n) => shortName(n, nameMap)).join(" & "),
      stat: `${noMercy.score} (gap ${noMercy.margin})`,
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Session Awards
      </h2>
      <div className="grid grid-cols-6 gap-3">
        {cards.map((card, i) => {
          // 5 cards: first 3 span 2 cols each (row 1), last 2 span 3 cols each (row 2)
          // 4 cards: all span 3 cols (2+2)
          // other counts: all span 2 cols (3 per row)
          let colSpan = "col-span-2";
          if (cards.length === 5) colSpan = i < 3 ? "col-span-2" : "col-span-3";
          else if (cards.length === 4) colSpan = "col-span-3";
          else if (cards.length === 2) colSpan = "col-span-3";
          else if (cards.length === 1) colSpan = "col-span-6";
          return <AwardCard key={card.title} {...card} colSpan={colSpan} />;
        })}
      </div>
    </div>
  );
}
