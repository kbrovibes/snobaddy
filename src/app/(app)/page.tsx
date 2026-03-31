import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getActiveSession, getAllSessions } from "@/lib/db/sessions";
import { createClient } from "@/lib/supabase-server";
import CreateSessionButton from "@/components/CreateSessionButton";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function SessionListPage() {
  const active = await getActiveSession();
  if (active) redirect(`/session/${active.id}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;

  const sessions = await getAllSessions();
  const seasonName = sessions[0]?.season?.name ?? "Sessions";

  return (
    <div className="flex flex-col px-4 py-4 gap-4">

      <div className="flex items-center gap-3">
        <Image src="/serve-logo.jpg" alt="Serve Sports" width={52} height={52} className="rounded-xl shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{seasonName}</h1>
          <p className="text-sm text-gray-500">No active session</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No sessions yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm text-gray-700">{formatDate(s.date)}</span>
              <div className="flex items-center gap-2">
                {s.status === "active" ? (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                ) : s.status === "pending" ? (
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Pending</span>
                ) : (
                  <span className="text-xs text-gray-400">Closed</span>
                )}
                <span className="text-gray-300 text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex justify-center pt-2">
          <CreateSessionButton />
        </div>
      )}

    </div>
  );
}
