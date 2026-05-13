export default function SeasonsLoading() {
  return (
    <div className="px-4 py-4 pb-24 space-y-6 animate-pulse">
      {/* Heading */}
      <div className="h-3 w-20 bg-border-light rounded mx-1" />

      {/* Section label */}
      <div className="space-y-3">
        <div className="h-3 w-16 bg-border-light rounded mx-1" />
        {/* Season cards */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-surface rounded-xl border border-border-light p-4 flex flex-col gap-2">
            <div className="h-5 w-40 bg-border-light rounded" />
            <div className="h-3 w-32 bg-border-light rounded" />
            <div className="flex gap-4 mt-1">
              <div className="h-3 w-20 bg-border-light rounded" />
              <div className="h-3 w-20 bg-border-light rounded" />
              <div className="h-3 w-16 bg-border-light rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
