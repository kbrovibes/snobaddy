import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlayerById } from "@/lib/db/players";
import { getPlayerSessionHistory, getPlayerMatches } from "@/lib/db/matches";
import WinPctChart from "@/components/WinPctChart";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

function SkillDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-xs ${i <= level ? "text-blue-500" : "text-gray-200"}`}>●</span>
      ))}
    </span>
  );
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);

  const player = await getPlayerById(id);
  if (!player) redirect("/");

  const [sessionHistory, { matches, total }] = await Promise.all([
    getPlayerSessionHistory(id),
    getPlayerMatches(id, page, PAGE_SIZE),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalWins = sessionHistory.reduce((s, r) => s + r.wins, 0);
  const totalLosses = sessionHistory.reduce((s, r) => s + r.losses, 0);
  const overallPct = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <BackButton />

      {/* Player header */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold shrink-0">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{player.name}</h1>
          <SkillDots level={player.skill_level} />
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-gray-900">{overallPct}%</p>
          <p className="text-xs text-gray-400">{totalWins}W {totalLosses}L</p>
        </div>
      </div>

      {/* Win % chart */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Win % by Session
        </h2>
        <WinPctChart data={sessionHistory} />
      </div>

      {/* Match history */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Match History · {total}
        </h2>

        {matches.length === 0 ? (
          <p className="text-sm text-gray-400">No matches yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {matches.map((m) => (
              <div key={m.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    m.won ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}>
                    {m.won ? "W" : "L"}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(m.date)}</span>
                  <span className="text-sm text-gray-700 truncate flex-1">
                    w/ {getFirstName(m.partner)}
                    <span className="text-gray-400"> vs </span>
                    {m.opponents.map(getFirstName).join(" & ")}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${m.won ? "text-green-600" : "text-red-400"}`}>
                    {m.my_score}–{m.opp_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100">
            {page > 1 ? (
              <Link href={`/players/${id}?page=${page - 1}`} className="text-sm text-blue-600 hover:underline">
                ← Prev
              </Link>
            ) : (
              <span className="text-sm text-gray-300">← Prev</span>
            )}
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link href={`/players/${id}?page=${page + 1}`} className="text-sm text-blue-600 hover:underline">
                Next →
              </Link>
            ) : (
              <span className="text-sm text-gray-300">Next →</span>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
