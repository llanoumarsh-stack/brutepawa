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
  const isCall = !!data.data?.callType;

  const options = {
    body:               data.body || "",
    icon:               "/icons/icon-192.png",
    badge:              "/icons/icon-192.png",
    tag:                data.tag || "bp-notification",
    renotify:           true,
    requireInteraction: isCall ? true : (data.requireInteraction || false),
    data:               data.data || {},
    actions:            data.actions || [],
    vibrate:            isCall
                          ? [500, 200, 500, 200, 500, 200, 500]
                          : (data.vibrate || [200, 100, 200]),
    silent:             false,
  };

  /* ── Delivery receipt: call server as soon as push is received (app can be closed) ── */
  const deliveryPromise = (data.data?.deliveryToken && data.data?.msgId)
    ? fetch(self.location.origin + "/api/messages/sw-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token:    data.data.deliveryToken,
          msgId:    data.data.msgId,
          toUserId: data.data.toUserId,
        }),
      }).catch(() => {})
    : Promise.resolve();

  e.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    deliveryPromise,
  ]));

  /* ── For calls: keep re-notifying every 4s while the notification persists ── */
  if (isCall) {
    let attempts = 0;
    const ring = setInterval(async () => {
      attempts++;
      if (attempts >= 5) { clearInterval(ring); return; }
      const openNotifs = await self.registration.getNotifications({ tag: "incoming-call" });
      if (!openNotifs.length) { clearInterval(ring); return; }
      await self.registration.showNotification(title, { ...options, renotify: true });
    }, 4000);
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d    = e.notification.data || {};
  const action = e.action;
  const isCall = !!d.callType;

  /* ── Reject call ── */
  if (action === "reject") {
    if (d.rejectUrl) {
      fetch(d.rejectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: d.fromUserId, type: "call:reject", payload: {} }),
      }).catch(() => {});
    }
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        const appClient = list.find((c) => c.url.startsWith(self.location.origin));
        if (appClient) {
          appClient.postMessage({ type: "bp:call-rejected", data: d });
        }
      })
    );
    return;
  }

  /* ── Accept call: open/focus app → dispatch incoming call → show call UI ── */
  if (action === "accept" && isCall) {
    const callData = {
      fromUserId: d.fromUserId,
      callType:   d.callType ?? "audio",
      callerName: d.callerName,
    };
    const targetUrl = new URL(d.url || "/messages", self.location.origin).href;

    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        const appClient = list.find((c) => c.url.startsWith(self.location.origin));
        if (appClient) {
          return appClient.focus().then((w) => {
            w.postMessage({ type: "bp:incoming-call", data: callData });
          });
        }
        return clients.openWindow(targetUrl).then((w) => {
          if (w) {
            /* Wait for the app to boot before posting the call event */
            setTimeout(() => w.postMessage({ type: "bp:incoming-call", data: callData }), 1800);
          }
        });
      })
    );
    return;
  }

  /* ── Default tap (no action button): open / navigate app ── */
  const url = d.url || "/";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const appClient = list.find((c) => c.url.startsWith(self.location.origin));

      if (appClient) {
        appClient.focus();
        if (isCall) {
          appClient.postMessage({ type: "bp:incoming-call", data: d });
        } else {
          /* Always use postMessage so the SPA router handles navigation via pushState+popstate */
          appClient.postMessage({ type: "bp:navigate", data: { url } });
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
