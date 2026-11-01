// Minimal service worker for message alerts. Android Chrome (and
// installed PWAs on iOS) only allow system notifications through a
// service worker registration, so the page calls
// registration.showNotification() and this file handles the tap.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inbox";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch (e) {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
