import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  date: string;
  status: string;
  is_test_session: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function statusBadge(status: string) {
  if (status === "active") return { label: "Live", color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" };
  if (status === "completed") return { label: "Completed", color: "bg-stone-100 text-stone-600 dark:bg-neutral-700 dark:text-neutral-300" };
  return { label: "Upcoming", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" };
}

export default async function ExplorePage() {
  // Fetch public data using service role (no auth required)
  const [
    { data: activeSeason },
    { data: sessions },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, start_date, end_date, status")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id, date, status, is_test_session, session_type, season_id")
      .order("date", { ascending: false }),
  ]);

  // Filter to active season, non-test, non-finals
  const seasonSessions = (sessions ?? []).filter(
    (s: SessionRow & { season_id: string; session_type?: string }) =>
      s.season_id === activeSeason?.id && !s.is_test_session && s.session_type !== "finals"
  );

  const completedSessions = seasonSessions.filter((s: SessionRow) => s.status === "completed");
  const upcomingSessions = seasonSessions
    .filter((s: SessionRow) => s.status === "pending")
    .sort((a: SessionRow, b: SessionRow) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const activeSessions = seasonSessions.filter((s: SessionRow) => s.status === "active");

  // Count matches + unique players for the season
  let playerCount = 0;
  let matchCount = 0;
  const sessionIds = completedSessions.map((s: SessionRow) => s.id);
  if (sessionIds.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
      .in("session_id", sessionIds);

    const playerIds = new Set<string>();
    for (const m of matchRows ?? []) {
      playerIds.add(m.team1_player1_id);
      playerIds.add(m.team1_player2_id);
      playerIds.add(m.team2_player1_id);
      playerIds.add(m.team2_player2_id);
    }
    playerCount = playerIds.size;
    matchCount = (matchRows ?? []).length;
  }

  const daysOfPlay = completedSessions.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-surface/80 backdrop-blur-md border-b border-border-light">
        <Link href="/welcome" className="flex items-center gap-2.5">
          <Image src="/serve-icon.png" alt="" width={24} height={24} className="rounded-lg" />
          <span className="font-bold text-heading text-sm tracking-tight">Serve Snoqualmie</span>
        </Link>
        <Link
          href="/login"
          className="px-4 py-1.5 text-sm font-semibold bg-stone-900 dark:bg-sky-600 text-white rounded-lg hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors"
        >
          Log in
        </Link>
      </header>

      <main className="flex-1 px-4 py-6 pb-20 max-w-lg mx-auto w-full">
        {/* Season header */}
        {activeSeason ? (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">Current Season</p>
            <h1 className="text-xl font-bold text-heading mt-0.5 px-1">{activeSeason.name}</h1>
            <p className="text-xs text-muted-light mt-1 px-1">
              {formatDate(activeSeason.start_date)} — {formatDate(activeSeason.end_date)}
            </p>
          </div>
        ) : (
          <div className="mb-6 text-center py-8">
            <span className="text-3xl">📅</span>
            <p className="text-sm text-muted-light mt-2">No active season right now. Check back soon!</p>
          </div>
        )}

        {/* Stats cards */}
        {daysOfPlay > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { emoji: "🏸", label: "Players", value: playerCount, unit: "this season" },
              { emoji: "🎯", label: "Matches", value: matchCount, unit: "played" },
              { emoji: "📅", label: "Days of Play", value: daysOfPlay, unit: "sessions" },
            ].map(({ emoji, label, value, unit }) => (
              <div key={label} className="bg-surface rounded-xl shadow-sm border border-border-light px-3 py-3 flex flex-col items-center gap-0.5 text-center">
                <span className="text-xl">{emoji}</span>
                <span className="text-2xl font-bold text-heading leading-none">{value}</span>
                <span className="text-xs font-semibold text-text leading-tight">{label}</span>
                <span className="text-[10px] text-muted-light leading-tight">{unit}</span>
              </div>
            ))}
          </div>
        )}

        {/* Active session callout */}
        {activeSessions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-2">Happening Now</p>
            {activeSessions.map((s: SessionRow) => (
              <div key={s.id} className="bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
                <span className="text-2xl">🔴</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-heading">{formatDate(s.date)}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">Session in progress</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming sessions */}
        {upcomingSessions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-2">Upcoming Sessions</p>
            <div className="flex flex-col gap-2">
              {upcomingSessions.map((s: SessionRow) => {
                const { label, color } = statusBadge(s.status);
                return (
                  <div key={s.id} className="bg-surface rounded-xl border border-border-light px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-heading">{formatDate(s.date)}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${color}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent sessions */}
        {completedSessions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-2">
              Recent Sessions
            </p>
            <div className="flex flex-col gap-2">
              {completedSessions.slice(0, 5).map((s: SessionRow) => (
                <div key={s.id} className="bg-surface rounded-xl border border-border-light px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{formatDate(s.date)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 dark:bg-neutral-700 dark:text-neutral-300">
                    Completed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-light mb-3">Want to join the action?</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 dark:bg-sky-600 text-white rounded-xl font-semibold shadow-sm hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors"
          >
            Join the club
          </Link>
        </div>
      </main>
    </div>
  );
}
