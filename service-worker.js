const CACHE_NAME = "vr-pelancaran-shell-v3";
const SHELL_URLS = [
  "./",
  "index.html",
  "js/local-media.js",
  "js/launch.js",
  "vendor/aframe.min.js",
  "assets/palm-energy-orb.png",
  "assets/cinematic-title.png",
].map((path) => new URL(path, self.registration.scope).toString());

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_URLS);
}

function shellCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function cachedShellResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(shellCacheKey(request));
  return cached || fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([self.skipWaiting(), cacheShell()]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key.startsWith("vr-pelancaran")).map((key) => caches.delete(key)))
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (SHELL_URLS.includes(shellCacheKey(event.request)) || event.request.mode === "navigate") {
    event.respondWith(cachedShellResponse(event.request));
  }
});
