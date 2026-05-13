export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAllSeasons } from "@/lib/db/seasons";
import SeasonCard from "@/components/SeasonCard";
import CreateSeasonForm from "@/components/CreateSeasonForm";

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-2">{label}</p>
  );
}

export default async function SeasonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!player?.is_admin) redirect("/");

  const seasons = await getAllSeasons();
  const hasActiveSeason = seasons.some((s) => s.status === "active");

  const ongoing  = seasons.filter((s) => s.status === "active");
  const upcoming = seasons.filter((s) => s.status === "upcoming").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past     = seasons.filter((s) => s.status === "completed").sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <div className="px-4 py-4 pb-24 space-y-6">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">Seasons</h1>

      {seasons.length === 0 && (
        <p className="text-sm text-muted-light text-center py-8">
          No seasons yet. Create the first one below.
        </p>
      )}

      {ongoing.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="Ongoing" />
          {ongoing.map((season) => (
            <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="Upcoming" />
          {upcoming.map((season) => (
            <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="flex items-center justify-between px-1 mb-2 cursor-pointer list-none">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
              Past Seasons <span className="font-normal text-muted-lighter">({past.length})</span>
            </p>
            <span className="text-muted-lighter text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="space-y-3 mt-2">
            {past.map((season) => (
              <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
            ))}
          </div>
        </details>
      )}

      <CreateSeasonForm lastSeasonName={seasons[0]?.name} />
    </div>
  );
}
