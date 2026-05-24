export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthPlayer } from "@/lib/auth";
import { getAllSeasons } from "@/lib/db/seasons";
import SeasonCard from "@/components/SeasonCard";
import CreateSeasonForm from "@/components/CreateSeasonForm";

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-2">{label}</p>
  );
}

function CollapsibleSection({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex items-center justify-between px-1 mb-2 cursor-pointer list-none">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
          {label} <span className="font-normal text-muted-lighter">({count})</span>
        </p>
        <span className="text-muted-lighter text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="space-y-3 mt-2">{children}</div>
    </details>
  );
}

export default async function SeasonsPage() {
  const authPlayer = await getAuthPlayer();
  if (!authPlayer?.isAdmin) redirect("/");

  const seasons = await getAllSeasons();
  const hasActiveSeason = seasons.some((s) => s.status === "active");

  const ongoing      = seasons.filter((s) => s.status === "active");
  const past         = seasons.filter((s) => s.status === "completed").sort((a, b) => b.start_date.localeCompare(a.start_date));
  const upcoming     = seasons.filter((s) => s.status === "upcoming").sort((a, b) => a.start_date.localeCompare(b.start_date));

  const lastSeason   = past[0] ?? null;
  const priorSeasons = past.slice(1);

  return (
    <div className="px-4 py-4 pb-24 space-y-6">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">Seasons</h1>

      {seasons.length === 0 && (
        <p className="text-sm text-muted-light text-center py-8">
          No seasons yet. Create the first one below.
        </p>
      )}

      {/* Ongoing — always expanded */}
      {ongoing.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="Ongoing" />
          {ongoing.map((season) => (
            <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
          ))}
        </div>
      )}

      {/* Last completed season — expanded by default */}
      {lastSeason && (
        <div className="space-y-3">
          <SectionLabel label="Last Season" />
          <SeasonCard {...lastSeason} hasActiveSeason={hasActiveSeason} defaultExpanded={true} />
        </div>
      )}

      {/* Prior seasons — collapsed */}
      {priorSeasons.length > 0 && (
        <CollapsibleSection label="Prior Seasons" count={priorSeasons.length}>
          {priorSeasons.map((season) => (
            <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
          ))}
        </CollapsibleSection>
      )}

      {/* Upcoming — collapsed */}
      {upcoming.length > 0 && (
        <CollapsibleSection label="Upcoming" count={upcoming.length}>
          {upcoming.map((season) => (
            <SeasonCard key={season.id} {...season} hasActiveSeason={hasActiveSeason} />
          ))}
        </CollapsibleSection>
      )}

      <CreateSeasonForm lastSeasonName={seasons[0]?.name} />
    </div>
  );
}
