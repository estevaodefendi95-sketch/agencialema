// Service worker mínimo: app shell offline básico, sem cache de API.
const CACHE = "lema-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca interceptar chamadas de backend/autenticação.
  if (url.pathname.startsWith("/functions") || url.pathname.startsWith("/auth")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/", { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "AgênciaLema";
  const link = data.link || "/";
  // Sempre exibir uma notificação: navegadores penalizam pushes silenciosos.
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.message || "",
      icon: "/icons/icon-192.png?v=2",
      badge: "/icons/badge-96.png?v=2",
      tag: data.tag || `lema-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      vibrate: [120, 60, 120],
      timestamp: Date.now(),
      data: { link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  const targetUrl = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url === targetUrl);
      if (existing) return existing.focus();
      const sameOrigin = clientsArr.find((c) => c.url.startsWith(self.location.origin));
      if (sameOrigin) return sameOrigin.navigate(targetUrl).then(() => sameOrigin.focus());
      return self.clients.openWindow(targetUrl);
    })
  );
});
