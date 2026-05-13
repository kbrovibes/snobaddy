import { getActivePlayers, getDeletedPlayers } from "@/lib/db/players";
import { getActiveSession, getSessionPresence } from "@/lib/db/sessions";
import { getAllUbrRatings, type UbrRating } from "@/lib/db/ubr";
import { getAppSetting } from "@/lib/db/settings";
import { getAuthPlayer } from "@/lib/auth";
import AdminPageContent from "@/components/AdminPageContent";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const authPlayer = await getAuthPlayer();
  const isAdmin = authPlayer?.isAdmin ?? false;
  const isGodMode = authPlayer?.isGodMode ?? false;

  const [players, deletedPlayers, activeSession, ubrMap, ubrEnabledSetting] = await Promise.all([
    getActivePlayers(),
    isGodMode ? getDeletedPlayers() : Promise.resolve([]),
    getActiveSession(),
    isAdmin ? getAllUbrRatings() : Promise.resolve(new Map<string, UbrRating>()),
    isAdmin ? getAppSetting("ubr_enabled") : Promise.resolve(null),
  ]);

  const ubrEnabled = ubrEnabledSetting === "true";
  const ubrRatings: Record<string, UbrRating> = {};
  if (ubrEnabled) {
    for (const [k, v] of ubrMap) {
      ubrRatings[k] = v;
    }
  }

  const presence = activeSession
    ? await getSessionPresence(activeSession.id)
    : [];

  return (
    <AdminPageContent
      players={players}
      deletedPlayers={deletedPlayers}
      presence={presence}
      sessionId={activeSession?.id}
      sessionDate={activeSession?.date}
      sessionActive={!!activeSession}
      isAdmin={isAdmin}
      isGodMode={isGodMode}
      ubrRatings={ubrEnabled ? ubrRatings : undefined}
    />
  );
}
