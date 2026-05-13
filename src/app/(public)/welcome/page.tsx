import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  // If user is already authenticated, send them to the app
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Image src="/serve-icon.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-heading text-sm tracking-tight">Serve Snoqualmie</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
        <div className="max-w-md mx-auto flex flex-col items-center gap-6">
          {/* Icon cluster */}
          <div className="text-6xl leading-none select-none">🏸</div>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-heading tracking-tight leading-tight">
              Serve Snoqualmie
            </h1>
            <p className="text-base sm:text-lg text-muted-light leading-relaxed max-w-sm mx-auto">
              Drop-in doubles badminton in Snoqualmie, WA.
              Track sessions, record matches, climb the leaderboard.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
            <Link
              href="/explore"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-surface border border-border-light rounded-xl text-heading font-semibold shadow-sm hover:bg-surface-alt active:bg-surface-alt transition-colors sm:min-w-[160px]"
            >
              <span className="text-lg leading-none">📊</span>
              See what&apos;s happening
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 dark:bg-sky-600 text-white rounded-xl font-semibold shadow-sm hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors sm:min-w-[160px]"
            >
              Join the club
            </Link>
          </div>

          {/* Details */}
          <div className="grid grid-cols-3 gap-3 w-full mt-4">
            {[
              { icon: "📅", label: "Mon & Thu", sub: "6–10 PM" },
              { icon: "🏟️", label: "2 Courts", sub: "Drop-in play" },
              { icon: "👥", label: "30–50", sub: "Players / session" },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="bg-surface rounded-xl border border-border-light px-3 py-3 flex flex-col items-center gap-0.5 text-center">
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-bold text-heading">{label}</span>
                <span className="text-[10px] text-muted-light">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-6 text-xs text-muted-lighter">
        Snoqualmie Valley Community Center
      </footer>
    </div>
  );
}
