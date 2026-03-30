import Image from "next/image";
import {
  getTodaySession,
  getUpcomingSession,
  getCheckedInPlayers,
  getPastSessionsThisSeason,
} from "@/lib/db/sessions";
import { createClient } from "@/lib/supabase-server";
import StartSessionButton from "@/components/StartSessionButton";
import CheckInButton from "@/components/CheckInButton";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("id, is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isAdmin = currentPlayer?.is_admin ?? false;
  const playerId = currentPlayer?.id;

  const todaySession = await getTodaySession();
  const upcomingSession = !todaySession ? await getUpcomingSession() : null;

  const checkedInPlayers = todaySession?.status === "active"
    ? await getCheckedInPlayers(todaySession.id)
    : [];

  const isCheckedIn = checkedInPlayers.some((p) => p.player_id === playerId);

  const pastSessions = todaySession
    ? await getPastSessionsThisSeason(todaySession.season.id, todaySession.date)
    : [];

  // ── No session today ──────────────────────────────────────────────────────
  if (!todaySession) {
    return (
      <div className="flex flex-col items-center px-4 py-8 gap-6">
        <Image src="/serve-logo.jpg" alt="Serve Sports" width={120} height={120} className="rounded-2xl" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Spring 2026</h1>
          <p className="text-gray-400 text-sm mt-1">No session today</p>
          {upcomingSession && (
            <p className="mt-2 text-blue-600 font-medium">
              Next up: {formatDate(upcomingSession.date)}
            </p>
          )}
        </div>
        {pastSessions.length === 0 && (
          <p className="text-xs text-gray-300">Season runs Mar 23 – May 21, 2026</p>
        )}
      </div>
    );
  }

  const isPending = todaySession.status === "pending";
  const isActive = todaySession.status === "active";

  // ── Session day ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      {/* Season header */}
      <div className="flex items-center gap-3">
        <Image src="/serve-logo.jpg" alt="Serve Sports" width={52} height={52} className="rounded-xl shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{todaySession.season.name}</h1>
          <p className="text-sm text-gray-500">{formatDate(todaySession.date)}</p>
        </div>
        <div className="ml-auto shrink-0">
          {isActive ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Ongoing
            </span>
          ) : (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
              Starting soon
            </span>
          )}
        </div>
      </div>

      {/* Admin: start session */}
      {isPending && isAdmin && (
        <StartSessionButton sessionId={todaySession.id} />
      )}

      {/* Non-admin pending */}
      {isPending && !isAdmin && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700 text-center">
          Tonight's session hasn't started yet. Check back soon!
        </div>
      )}

      {/* Active session */}
      {isActive && (
        <>
          {/* Check-in */}
          <CheckInButton sessionId={todaySession.id} alreadyCheckedIn={isCheckedIn} />

          {/* Who's here */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Who's Here · {checkedInPlayers.length}
            </h2>
            {checkedInPlayers.length === 0 ? (
              <p className="text-sm text-gray-400">No one checked in yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {checkedInPlayers.map((p) => (
                  <div key={p.player_id} className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <SkillDots level={p.skill_level} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scoreboard placeholder — populated in spec 03 */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Tonight's Scores
            </h2>
            <p className="text-sm text-gray-400">Record a match to see scores here.</p>
          </div>

          {/* Record match — spec 03 */}
          <button
            disabled
            className="w-full py-3 bg-gray-100 text-gray-400 font-semibold rounded-xl cursor-not-allowed"
          >
            🎾 Record a Match — Coming Soon
          </button>
        </>
      )}

      {/* Past sessions this season */}
      {pastSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-2">
            {pastSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{formatDate(s.date)}</span>
                <span className="text-gray-400 capitalize">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
