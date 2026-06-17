const CACHE = "brutepawa-v20260617";
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

  /* ── Network-first : toujours chercher la version fraîche sur le réseau ──
     On met en cache seulement si le réseau répond, sinon on sert le cache
     comme fallback (mode hors-ligne). */
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
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
  const url = d.url || "/";
  const action = e.action;
  const isCall = !!d.callType;

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
      const appClient = list.find((c) => c.url.startsWith(self.location.origin));

      if (appClient) {
        appClient.focus();
        if (isCall) {
          appClient.postMessage({ type: "bp:incoming-call", data: d });
        } else {
          const target = new URL(url, self.location.origin).href;
          appClient.navigate(target).catch(() => {
            appClient.postMessage({ type: "bp:navigate", data: { url } });
          });
        }
        return;
      }

      return clients.openWindow(new URL(url, self.location.origin).href).then((w) => {
        if (w && isCall) {
          setTimeout(() => w.postMessage({ type: "bp:incoming-call", data: d }), 1500);
        }
      });
    })
  );
});
