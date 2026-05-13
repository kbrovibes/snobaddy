export default function LeaderboardLoading() {
  return (
    <div className="px-4 py-4 pb-20 animate-pulse">
      {/* Heading */}
      <div className="mb-4 px-1">
        <div className="h-3 w-24 bg-border-light rounded mb-1.5" />
        <div className="h-4 w-36 bg-border-light rounded" />
      </div>

      {/* Table header */}
      <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
        <div className="flex gap-2 px-3 py-2 border-b border-border-light">
          <div className="h-3 w-6 bg-border-light rounded" />
          <div className="h-3 w-20 bg-border-light rounded flex-1" />
          <div className="h-3 w-6 bg-border-light rounded" />
          <div className="h-3 w-6 bg-border-light rounded" />
          <div className="h-3 w-8 bg-border-light rounded" />
        </div>
        {/* Table rows */}
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
    </div>
  );
}
