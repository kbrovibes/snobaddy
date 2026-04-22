"use client";

interface LogEntry {
  id: string;
  player_name: string;
  field: "wins" | "losses";
  delta: 1 | -1;
  created_at: string;
}

interface MatchEntry {
  id: string;
  played_at: string;
  team1: string[];
  team2: string[];
  team1_score: number;
  team2_score: number;
  winning_team: 1 | 2;
}

type FeedItem =
  | { type: "log"; data: LogEntry }
  | { type: "match"; data: MatchEntry };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function WhiteboardFeed({
  logEntries,
  matches,
  nameMap,
}: {
  logEntries: LogEntry[];
  matches: MatchEntry[];
  nameMap: Map<string, string>;
}) {
  // Interleave log entries and matches by timestamp, newest first
  const feed: FeedItem[] = [
    ...logEntries.map((e) => ({ type: "log" as const, data: e, ts: new Date(e.created_at).getTime() })),
    ...matches.map((m) => ({ type: "match" as const, data: m, ts: new Date(m.played_at).getTime() })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .map(({ type, data }) => ({ type, data }) as FeedItem);

  if (feed.length === 0) return null;

  function shortName(name: string) {
    if (nameMap.get(name)) return nameMap.get(name)!;
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return name;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Activity
      </h2>
      <div className="flex flex-col gap-1">
        {feed.map((item) => {
          if (item.type === "match") {
            const m = item.data;
            const w = m.winning_team === 1 ? m.team1 : m.team2;
            const l = m.winning_team === 1 ? m.team2 : m.team1;
            return (
              <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 bg-sky-50 rounded-lg">
                <span className="text-xs">&#127992;</span>
                <div className="flex-1 text-xs">
                  <span className="font-semibold text-sky-800">
                    {w.map((n) => shortName(n)).join(" & ")}
                  </span>
                  <span className="text-sky-600"> beat </span>
                  <span className="font-medium text-sky-700">
                    {l.map((n) => shortName(n)).join(" & ")}
                  </span>
                </div>
                <span className="text-[10px] text-sky-400 shrink-0">{timeAgo(m.played_at)}</span>
              </div>
            );
          }

          const e = item.data;
          const isWin = e.field === "wins";
          const isPlus = e.delta === 1;
          return (
            <div key={e.id} className="flex items-center gap-2 py-1 px-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isWin ? "bg-green-400" : "bg-orange-400"
              }`} />
              <span className="flex-1 text-xs text-stone-600">
                <span className="font-medium">{shortName(e.player_name)}</span>
                {" "}
                <span className={isWin ? "text-green-600" : "text-orange-500"}>
                  {isPlus ? "+" : "−"}1 {isWin ? "W" : "L"}
                </span>
              </span>
              <span className="text-[10px] text-stone-400 shrink-0">{timeAgo(e.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
