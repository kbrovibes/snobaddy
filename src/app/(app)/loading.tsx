export default function SessionLoading() {
  return (
    <div className="flex flex-col px-4 py-4 gap-4 animate-pulse">
      {/* Season name */}
      <div className="h-3 w-24 bg-border-light rounded mx-1" />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface rounded-xl border border-border-light px-3 py-3 flex flex-col items-center gap-1.5">
            <div className="h-5 w-5 bg-border-light rounded" />
            <div className="h-6 w-8 bg-border-light rounded" />
            <div className="h-3 w-12 bg-border-light rounded" />
          </div>
        ))}
      </div>

      {/* Session cards */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface rounded-xl border border-border-light p-4 flex flex-col gap-2">
          <div className="h-4 w-32 bg-border-light rounded" />
          <div className="h-3 w-20 bg-border-light rounded" />
        </div>
      ))}
    </div>
  );
}
