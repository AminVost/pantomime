const CACHE = "adazi-pwa-v1.5.0";
const CORE = ["/brand/adazi-mascot-768.webp", "/brand/adazi-lockup-1440.webp", "/brand/adazi-mascot-96.webp", "/brand/adazi-mascot-192.webp", "/brand/adazi-mascot-384.webp", "/brand/adazi-lockup-480.webp", "/brand/adazi-lockup-960.webp", "/manifest.webmanifest", "/data/catalog.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"];

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined)));
  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) throw new Error("shell fetch failed");
  await cache.put("/", response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/_next/static/") || url.startsWith("/icons/") || url.startsWith("/brand/") || url === "/manifest.webmanifest");
  await Promise.all([...new Set(assets)].map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put("/", response.clone()));
      return response;
    }).catch(() => caches.match("/").then((response) => response || Response.error())));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    if (cached) {
      event.waitUntil(fetch(request).then((response) => {
        if (response.ok) return caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      }).catch(() => undefined));
      return cached;
    }
    return fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    });
  }));
});
