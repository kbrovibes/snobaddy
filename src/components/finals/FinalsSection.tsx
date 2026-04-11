import Link from "next/link";
import type { FinalsEvent } from "@/lib/db/finals";
import CreateFinalsButton from "./CreateFinalsButton";

function statusLabel(status: FinalsEvent["status"]) {
  switch (status) {
    case "draft":             return { text: "Draft",             cls: "text-stone-500 bg-stone-100" };
    case "breakdown_generated": return { text: "Groups Ready",   cls: "text-amber-600 bg-amber-50" };
    case "sessions_created":  return { text: "Sessions Set",      cls: "text-sky-600 bg-sky-50" };
    case "active":            return { text: "In Progress",       cls: "text-green-700 bg-green-50" };
    case "completed":         return { text: "Completed",         cls: "text-teal-600 bg-teal-50" };
  }
}

export default function FinalsSection({ event }: { event: FinalsEvent | null }) {
  const label = event ? statusLabel(event.status) : null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 px-1 mb-1">
        Season Finals
      </p>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {event ? (
          <Link
            href={`/finals/${event.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 active:bg-amber-50 transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-stone-800">{event.name}</span>
              <span className="text-xs text-stone-400">
                {event.participant_count} player{event.participant_count !== 1 ? "s" : ""} added
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${label!.cls}`}>
                {label!.text}
              </span>
              <span className="text-stone-300 text-sm">→</span>
            </div>
          </Link>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-stone-400 mb-3">
              No finals event yet for this season.
            </p>
            <CreateFinalsButton />
          </div>
        )}
      </div>
    </div>
  );
}
