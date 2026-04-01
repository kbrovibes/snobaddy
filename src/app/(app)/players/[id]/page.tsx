import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/players";
import { getPlayerSessionHistory, getPlayerMatchesBySession } from "@/lib/db/matches";
import WinPctChart from "@/components/WinPctChart";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const player = await getPlayerById(id);
  if (!player) redirect("/");

  const [sessionHistory, matchesBySession] = await Promise.all([
    getPlayerSessionHistory(id),
    getPlayerMatchesBySession(id),
  ]);

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
          Match History
        </h2>

        {matchesBySession.length === 0 ? (
          <p className="text-sm text-gray-400">No matches yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {matchesBySession.map((group) => (
              <div key={group.session_id}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {formatDate(group.date)}
                </p>
                <div className="flex flex-col divide-y divide-gray-100">
                  {group.matches.map((m) => (
                    <div key={m.id} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          m.won ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {m.won ? "W" : "L"}
                        </span>
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
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
