/* YeldnIN service worker — web-push & notifications only. NO request interception.
 *
 * ⚠ DO NOT add a `fetch` event listener here. A service worker with ANY fetch
 * handler routes every navigation + every subresource (JS/CSS/images/API) through
 * the worker; browsers terminate idle workers, so each request then has to
 * cold-boot the worker before falling through to the network — which made the
 * whole app feel slow (the previous no-op `fetch` handler did exactly that). A
 * fetch handler is NOT required for PWA installability, so we keep the worker out
 * of the request path entirely: navigations and assets go straight to the network.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Defensive: drop any caches a previous SW version may have created.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});

// NB: intentionally no `fetch` listener — see the header note.

// ── Web push (active once a server sends pushes) ─────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "YeldnIN";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
