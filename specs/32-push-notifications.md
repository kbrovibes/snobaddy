# Spec 32: Push Notifications

## What it does

Sends browser push notifications to players who have opted in, using the Web Push API and a service worker.

**Admin users** receive notifications when:
- A session is opened (started/activated)
- A session is closed (completed)
- A session is starting soon (scheduled cron — e.g. 30 min before typical session time)

**Non-admin users** receive notifications when:
- They are checked in to a session (by an admin)
- They are checked out of a session (by an admin)

Self-check-in/check-out does NOT trigger a notification (the user already knows).

## What it does NOT do

- No in-app notification center or inbox — push only
- No per-notification-type preference toggles (future enhancement)
- No email or SMS fallback
- No notification for match results, scoreboard changes, or leaderboard updates
- No notification grouping or throttling (volume is low enough it's not needed)

## How Push Notifications work (Web Push + VAPID)

1. **Service worker** registers in the browser on app load
2. User taps "Enable notifications" → browser shows permission prompt
3. On grant, the browser returns a `PushSubscription` object (endpoint URL + encryption keys)
4. App POSTs the subscription to the server, which stores it in `push_subscriptions` table
5. When a trigger event occurs (session opened, player checked in, etc.), the server sends a push message to all relevant subscriptions using the `web-push` npm library
6. The service worker receives the push event and calls `self.registration.showNotification()`

**VAPID keys** — a one-time key pair generated via `web-push generate-vapid-keys`. The public key is exposed to the browser; the private key stays server-side in env vars.

## Data / DB changes

### New table: `push_subscriptions`

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (player_id, endpoint)
);

create index idx_push_subs_player on push_subscriptions(player_id);
```

Each row stores one browser's push subscription for one player. A player can have multiple subscriptions (phone + laptop). The `endpoint`, `p256dh`, and `auth` fields come directly from the browser's `PushSubscription` object.

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `VAPID_PUBLIC_KEY` | Browser + server | VAPID public key (base64url) |
| `VAPID_PRIVATE_KEY` | Server only | VAPID private key (base64url) |
| `VAPID_SUBJECT` | Server only | Contact URI, e.g. `mailto:admin@servesnoqualmie.com` |

Generate with: `npx web-push generate-vapid-keys`

## API

### `POST /api/push/subscribe`

Saves a push subscription for the authenticated player.

**Auth:** Any logged-in player.

**Request body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "base64url...",
    "auth": "base64url..."
  }
}
```

**Response:** `{ "ok": true }`

### `POST /api/push/unsubscribe`

Removes a push subscription by endpoint.

**Auth:** Any logged-in player.

**Request body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Response:** `{ "ok": true }`

### `POST /api/push/send` (internal — not called by the client directly)

Server-side helper function (not an API route). Called from existing API routes when trigger events occur.

## Trigger points (where to add push sends)

| Event | Route | Recipients | Message |
|-------|-------|------------|---------|
| Session opened | `POST /api/sessions/[id]/start` | All admin subscribers | "Session started — [date]" |
| Session closed | `POST /api/sessions/[id]/close` | All admin subscribers | "Session closed — [date]" |
| Player checked in (by admin) | `POST /api/sessions/[id]/checkin` | The checked-in player | "You've been checked in to tonight's session" |
| Player checked out (by admin) | `POST /api/sessions/[id]/checkout` | The checked-out player | "You've been checked out of tonight's session" |

**Self-actions are excluded:** If `targetPlayerId === currentPlayer.id`, no notification is sent.

### "Starting soon" cron (future / Phase 2)

A Vercel cron job at e.g. 5:30 PM on Mon/Thu that checks for a pending session today and notifies all admin subscribers: "Session tonight — don't forget to open check-in!" This is deferred to Phase 2 since it requires Vercel cron configuration.

## UI

### Notification opt-in banner

A dismissable banner shown at the top of the session page for players who haven't yet subscribed:

```
+-------------------------------------------------------+
| Enable notifications to stay updated on sessions  [Enable]  [x] |
+-------------------------------------------------------+
```

- On tap "Enable" → call `Notification.requestPermission()` → if granted, subscribe and POST to `/api/push/subscribe`
- On tap "x" → hide banner, store dismissal in localStorage
- If permission is `denied` (user blocked at browser level), hide the banner permanently

### Settings / unsubscribe

No dedicated settings page needed. If a user wants to disable, they revoke notification permission in their browser/OS settings, and the server will get a 410 Gone when it tries to send — at which point the subscription row is deleted automatically (cleanup on failed send).

## Service Worker

### `public/sw.js`

A minimal service worker that:

1. Listens for `push` events → shows a notification with the payload title/body
2. Listens for `notificationclick` → opens or focuses the app

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Snobaddy', {
      body: data.body ?? '',
      icon: '/serve-icon.png',
      badge: '/serve-icon.png',
      data: { url: data.url ?? '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
```

### Registration (in app layout or a client component)

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## Files to create/modify

| File | Action |
|------|--------|
| `public/sw.js` | Create — service worker for push events |
| `src/lib/push.ts` | Create — server-side `sendPush()` helper using `web-push` |
| `src/lib/db/push-subscriptions.ts` | Create — DB queries for subscribe/unsubscribe/get subscriptions |
| `src/app/api/push/subscribe/route.ts` | Create — save subscription endpoint |
| `src/app/api/push/unsubscribe/route.ts` | Create — remove subscription endpoint |
| `src/components/PushNotificationBanner.tsx` | Create — opt-in banner component |
| `src/app/(app)/layout.tsx` | Modify — register service worker + render banner |
| `src/app/api/sessions/[id]/start/route.ts` | Modify — send push to admins on session start |
| `src/app/api/sessions/[id]/close/route.ts` | Modify — send push to admins on session close |
| `src/app/api/sessions/[id]/checkin/route.ts` | Modify — send push to player on admin check-in |
| `src/app/api/sessions/[id]/checkout/route.ts` | Modify — send push to player on admin check-out |

## Dependencies

```bash
npm install web-push
npm install -D @types/web-push
```

## Acceptance Criteria

- [ ] Service worker registers successfully on app load
- [ ] "Enable notifications" banner appears for users who haven't subscribed
- [ ] Tapping "Enable" triggers browser permission prompt
- [ ] On permission grant, subscription is saved to `push_subscriptions` table
- [ ] Admin receives push notification when a session is started
- [ ] Admin receives push notification when a session is closed
- [ ] Non-admin player receives push notification when checked in by an admin
- [ ] Non-admin player receives push notification when checked out by an admin
- [ ] Self-check-in/check-out does NOT trigger a notification
- [ ] Failed push sends (410 Gone) auto-delete the stale subscription
- [ ] Notification tap opens the app to the relevant session page
- [ ] Works on Android Chrome and iOS Safari (16.4+) when added to home screen
