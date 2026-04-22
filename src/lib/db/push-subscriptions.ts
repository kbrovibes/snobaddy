import { supabase } from "@/lib/supabase";

export interface PushSubscriptionRecord {
  id: string;
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Save a push subscription for a player (upsert by player+endpoint). */
export async function saveSubscription(
  playerId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { player_id: playerId, endpoint, p256dh, auth },
      { onConflict: "player_id,endpoint" }
    );
  if (error) throw error;
}

/** Remove a push subscription by player + endpoint. */
export async function removeSubscription(playerId: string, endpoint: string) {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("player_id", playerId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}

/** Remove a subscription by endpoint (used when push send gets 410 Gone). */
export async function removeSubscriptionByEndpoint(endpoint: string) {
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Get all subscriptions for a specific player. */
export async function getSubscriptionsForPlayer(
  playerId: string
): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("player_id", playerId);
  if (error) throw error;
  return data ?? [];
}

/** Get all subscriptions for all admin players. */
export async function getAdminSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const { data: admins, error: adminErr } = await supabase
    .from("players")
    .select("id")
    .eq("is_admin", true);
  if (adminErr) throw adminErr;
  if (!admins?.length) return [];

  const adminIds = admins.map((a) => a.id);
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("player_id", adminIds);
  if (error) throw error;
  return data ?? [];
}
