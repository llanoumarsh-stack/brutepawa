const CACHE = "brutepawa-v1";
const PRECACHE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: "Brute Pawa", body: e.data.text() }; }

  const title = data.title || "Brute Pawa";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "bp-notification",
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
    vibrate: data.callType ? [300, 100, 300, 100, 300] : [200, 100, 200],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const url = d.url || "/messages";
  const action = e.action;

  if (action === "reject") {
    if (d.rejectUrl) {
      fetch(d.rejectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${d.token || ""}` },
        body: JSON.stringify({ to: d.fromUserId, type: "call:reject", payload: {} }),
      }).catch(() => {});
    }
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: "bp:incoming-call", data: d });
          return;
        }
      }
      return clients.openWindow(url).then((w) => {
        if (w) {
          setTimeout(() => w.postMessage({ type: "bp:incoming-call", data: d }), 1500);
        }
      });
    })
  );
});
