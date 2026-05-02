export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAllSeasons } from "@/lib/db/seasons";
import SeasonCard from "@/components/SeasonCard";
import CreateSeasonForm from "@/components/CreateSeasonForm";

export default async function SeasonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!player?.is_god_mode) redirect("/");

  const seasons = await getAllSeasons();
  const hasActiveSeason = seasons.some((s) => s.status === "active");

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">Seasons</h1>

      {seasons.length === 0 && (
        <p className="text-sm text-muted-light text-center py-8">
          No seasons yet. Create the first one below.
        </p>
      )}

      {seasons.map((season) => (
        <SeasonCard
          key={season.id}
          {...season}
          hasActiveSeason={hasActiveSeason}
        />
      ))}

      <CreateSeasonForm lastSeasonName={seasons[0]?.name} />
    </div>
  );
}
