export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getActiveSeason } from "@/lib/db/seasons";
import { getAuthPlayer } from "@/lib/auth";
import LeaderboardData from "./LeaderboardData";
import RefreshButton from "./RefreshButton";
import { redirect } from "next/navigation";

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border-light overflow-hidden animate-pulse">
      <div className="flex gap-2 px-3 py-2 border-b border-border-light">
        <div className="h-3 w-6 bg-border-light rounded" />
        <div className="h-3 w-20 bg-border-light rounded flex-1" />
        <div className="h-3 w-6 bg-border-light rounded" />
        <div className="h-3 w-6 bg-border-light rounded" />
        <div className="h-3 w-8 bg-border-light rounded" />
      </div>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex gap-2 px-3 py-2.5 border-b border-border-light last:border-0">
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-24 bg-border-light rounded flex-1" />
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-8 bg-border-light rounded" />
        </div>
      ))}
    </div>
  );
}

export default async function LeaderboardPage() {
  const [authPlayer, activeSeason] = await Promise.all([
    getAuthPlayer(),
    getActiveSeason(),
  ]);
  const isAdmin = authPlayer?.isAdmin ?? false;

  if (!isAdmin) redirect("/");

  return (
    <div className="px-4 py-4 pb-20">
      <div className="mb-4 px-1 flex items-start justify-between">
        <div>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light">Leaderboard</h1>
          {activeSeason?.name && (
            <p className="text-sm font-semibold text-heading mt-0.5">{activeSeason.name}</p>
          )}
        </div>
        <RefreshButton />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <LeaderboardData
          seasonId={activeSeason?.id}
          seasonLockDate={activeSeason?.stats_lock_date ?? null}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  );
}
