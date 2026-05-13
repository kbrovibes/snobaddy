export default function PlayersLoading() {
  return (
    <div className="px-4 py-4 animate-pulse">
      {/* Search bar */}
      <div className="h-10 bg-surface border border-border-light rounded-xl mb-4" />

      {/* Player rows */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border-light p-3 flex items-center gap-3">
            <div className="h-8 w-8 bg-border-light rounded-full" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-4 w-28 bg-border-light rounded" />
              <div className="h-3 w-16 bg-border-light rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
