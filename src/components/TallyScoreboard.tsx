import type { TallyEntry } from "@/lib/db/tally";

interface Props {
  entries: TallyEntry[];
}

export default function TallyScoreboard({ entries }: Props) {
  const sorted = [...entries].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Final Scores · Tally-only
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-1.5 font-medium">Player</th>
            <th className="text-center pb-1.5 font-medium w-10">W</th>
            <th className="text-center pb-1.5 font-medium w-10">L</th>
            <th className="text-center pb-1.5 font-medium w-14">Win%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const total = e.wins + e.losses;
            const pct = total > 0 ? Math.round((e.wins / total) * 100) : 0;
            return (
              <tr key={e.player_id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-medium text-gray-900">{e.player_name}</td>
                <td className="py-2 text-center font-semibold text-green-600">{e.wins}</td>
                <td className="py-2 text-center text-gray-400">{e.losses}</td>
                <td className="py-2 text-center text-gray-500">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
