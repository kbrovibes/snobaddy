import { supabase as serviceClient } from "@/lib/supabase";
import Link from "next/link";
import AuthRedirect from "./AuthRedirect";

export const revalidate = 3600; // Re-generate at most once per hour

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function WelcomePage() {
  // Fetch public season data (service role — no RLS, no cookies = ISR-compatible)
  const [{ data: activeSeason }, { data: sessions }] = await Promise.all([
    serviceClient
      .from("seasons")
      .select("id, name, start_date, end_date, status")
      .eq("status", "active")
      .maybeSingle(),
    serviceClient
      .from("sessions")
      .select("id, date, status, is_test_session, session_type, season_id")
      .order("date", { ascending: false }),
  ]);

  // Filter to active season, non-test, non-finals
  const seasonSessions = (sessions ?? []).filter(
    (s) => s.season_id === activeSeason?.id && !s.is_test_session && s.session_type !== "finals"
  );
  const completedSessions = seasonSessions.filter((s) => s.status === "completed");
  const upcomingSessions = seasonSessions
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const liveSession = seasonSessions.find((s) => s.status === "active");

  // Stats: matches + players from completed non-test, non-finals sessions
  let playerCount = 0;
  let matchCount = 0;
  const completedIds = completedSessions.map((s) => s.id);
  if (completedIds.length > 0) {
    const [{ data: matchRows }, { data: tallyRows }] = await Promise.all([
      serviceClient
        .from("matches")
        .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
        .in("session_id", completedIds)
        .eq("match_type", "regular"),
      serviceClient
        .from("session_tally")
        .select("player_id, wins")
        .in("session_id", completedIds),
    ]);

    const playerIds = new Set<string>();
    for (const m of matchRows ?? []) {
      playerIds.add(m.team1_player1_id);
      playerIds.add(m.team1_player2_id);
      playerIds.add(m.team2_player1_id);
      playerIds.add(m.team2_player2_id);
    }
    matchCount = (matchRows ?? []).length;

    // Add tally players + approximate tally matches
    let tallyWins = 0;
    for (const t of tallyRows ?? []) {
      playerIds.add(t.player_id);
      tallyWins += t.wins ?? 0;
    }
    matchCount += Math.round(tallyWins / 2);
    playerCount = playerIds.size;
  }

  const daysOfPlay = completedSessions.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthRedirect />
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.gif" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-heading text-sm tracking-tight">Serve Snoqualmie</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-1.5 text-sm font-semibold bg-stone-900 dark:bg-sky-600 text-white rounded-lg hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors"
        >
          Log in
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-5 pt-6 pb-8">
        <div className="max-w-md mx-auto w-full flex flex-col gap-5">

          {/* Hero — compact */}
          <div className="text-center flex flex-col items-center gap-2">
            <div className="text-5xl leading-none select-none">🏸</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-heading tracking-tight leading-tight">
              Serve Snoqualmie
            </h1>
            <p className="text-sm text-muted-light leading-relaxed max-w-xs mx-auto">
              Drop-in doubles badminton in Snoqualmie, WA. Mondays & Thursdays, 6–10 PM.
            </p>
          </div>

          {/* Live session callout */}
          {liveSession && (
            <div className="bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-800 px-4 py-2.5 flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                Live now — {formatDate(liveSession.date)}
              </span>
            </div>
          )}

          {/* Season stats row */}
          {activeSeason && daysOfPlay > 0 && (
            <div>
              <div className="flex items-baseline justify-between px-1 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-light">{activeSeason.name}</span>
                <span className="text-[10px] text-muted-lighter">
                  {formatDate(activeSeason.start_date)} — {formatDate(activeSeason.end_date)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: "👥", val: playerCount, label: "Players" },
                  { emoji: "🎯", val: matchCount, label: "Matches" },
                  { emoji: "📅", val: daysOfPlay, label: "Sessions" },
                ].map(({ emoji, val, label }) => (
                  <div key={label} className="bg-surface rounded-xl border border-border-light py-2 flex flex-col items-center gap-0.5">
                    <span className="text-base leading-none">{emoji}</span>
                    <span className="text-xl font-bold text-heading leading-none">{val}</span>
                    <span className="text-[10px] font-semibold text-muted-light">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming sessions — compact horizontal chips */}
          {upcomingSessions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-1.5">Upcoming</p>
              <div className="flex gap-2 overflow-x-auto">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="bg-surface rounded-lg border border-border-light px-3 py-2 flex-shrink-0 flex items-center gap-2">
                    <span className="text-sm leading-none">🗓️</span>
                    <span className="text-xs font-semibold text-heading">{formatDate(s.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-3 bg-stone-900 dark:bg-sky-600 text-white rounded-xl font-semibold shadow-sm hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors"
          >
            Join the club
          </Link>

        </div>
      </main>

      <footer className="text-center pb-4 text-[10px] text-muted-lighter">
        Snoqualmie Valley Community Center
      </footer>
    </div>
  );
}
