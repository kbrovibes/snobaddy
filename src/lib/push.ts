import webpush from "web-push";
import {
  getAdminSubscriptions,
  getSubscriptionsForPlayer,
  removeSubscriptionByEndpoint,
  type PushSubscriptionRecord,
} from "@/lib/db/push-subscriptions";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@servesnoqualmie.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send a push notification to a list of subscriptions. Cleans up stale ones. */
async function sendToSubscriptions(
  subs: PushSubscriptionRecord[],
  payload: PushPayload
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured — skipping push notifications");
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — clean up
          await removeSubscriptionByEndpoint(sub.endpoint);
        } else {
          console.error("Push send failed:", err);
        }
      }
    })
  );
}

/** Notify all admin subscribers. */
export async function notifyAdmins(payload: PushPayload) {
  const subs = await getAdminSubscriptions();
  await sendToSubscriptions(subs, payload);
}

/** Notify a specific player. */
export async function notifyPlayer(playerId: string, payload: PushPayload) {
  const subs = await getSubscriptionsForPlayer(playerId);
  await sendToSubscriptions(subs, payload);
}
