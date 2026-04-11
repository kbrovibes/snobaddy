import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getFinalsById } from "@/lib/db/finals";
import FinalsEventTabs from "./FinalsEventTabs";

export const dynamic = "force-dynamic";

export default async function FinalsEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("id, is_god_mode")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isGodMode =
    (currentPlayer as unknown as { is_god_mode?: boolean } | null)?.is_god_mode ?? false;

  if (!isGodMode) redirect("/");

  const event = await getFinalsById(id);
  if (!event) redirect("/");

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/?list=1" className="text-stone-400 hover:text-stone-600 text-sm">
          ← Sessions
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h1 className="text-xl font-bold text-stone-900">{event.name}</h1>
        </div>
        {event.season && (
          <p className="text-sm text-stone-400 mt-0.5 ml-8">{event.season.name}</p>
        )}
      </div>

      <FinalsEventTabs event={event} />
    </div>
  );
}
