import NavLink from "@/components/NavLink";
import type { FinalsEvent, FinalsSessionPair, FinalsSessionInfo } from "@/lib/db/finals";
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

function SessionCard({ label, session }: { label: string; session: FinalsSessionInfo }) {
  const statusInfo = {
    pending:   { text: "Starting soon", cls: "text-orange-600 bg-orange-50" },
    active:    { text: "In Progress",   cls: "text-white bg-sky-700" },
    completed: { text: "Completed",     cls: "text-teal-600 bg-teal-50" },
  }[session.status];

  const date = new Date(session.date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <NavLink
      href={`/session/${session.id}`}
      className="flex items-center justify-between px-4 py-2 hover:bg-stone-50 active:bg-amber-50 transition-colors border-t border-stone-100"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-300">└</span>
        <span className="text-sm text-stone-700">{label}</span>
        <span className="text-xs text-stone-400">{date}</span>
      </div>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
        {statusInfo.text}
      </span>
    </NavLink>
  );
}

// Derive display status from session states (more accurate than event.status)
function deriveStatus(event: FinalsEvent, sessionPair?: FinalsSessionPair | null) {
  const sessions = [sessionPair?.day1, sessionPair?.day2].filter(Boolean);
  if (sessions.length > 0) {
    const allCompleted = sessions.every((s) => s!.status === "completed");
    const anyActive = sessions.some((s) => s!.status === "active");
    const anyCompleted = sessions.some((s) => s!.status === "completed");
    if (allCompleted) return statusLabel("completed");
    if (anyActive || anyCompleted) return statusLabel("active");
  }
  return statusLabel(event.status);
}

export default function FinalsSection({
  event,
  sessionPair,
  pastEvents,
}: {
  event: FinalsEvent | null;
  sessionPair?: FinalsSessionPair | null;
  pastEvents?: FinalsEvent[];
}) {
  const label = event ? deriveStatus(event, sessionPair) : null;

  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Season Finals
        </p>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {event ? (
          <>
            <NavLink
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
            </NavLink>
            {sessionPair?.day1 && (
              <SessionCard label="Day 1 — Groups A & B" session={sessionPair.day1} />
            )}
            {sessionPair?.day2 && (
              <SessionCard label="Day 2 — Group C" session={sessionPair.day2} />
            )}
            {event.status === "completed" && (
              <div className="px-4 py-3 border-t border-stone-100">
                <CreateFinalsButton label="Create New Finals" />
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-stone-400 mb-3">
              No finals event yet for this season.
            </p>
            <CreateFinalsButton />
          </div>
        )}
      </div>

      {/* Past finals */}
      {pastEvents && pastEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-2">
          <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Past Finals
            </p>
          </div>
          {pastEvents.map((e) => {
            const s = statusLabel(e.status);
            const date = new Date(e.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            });
            return (
              <NavLink
                key={e.id}
                href={`/finals/${e.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 active:bg-amber-50 transition-colors border-b border-stone-100 last:border-0"
              >
                <div>
                  <span className="text-sm text-stone-700">{e.name}</span>
                  <p className="text-xs text-stone-400">{date}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                  {s.text}
                </span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
