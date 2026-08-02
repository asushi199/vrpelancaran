importScripts("js/offline-media-core.js");

const CACHE_NAME = "vr-pelancaran-media-v2";
const MINIMUM_MEDIA_BYTES = 1024 * 1024;
const SHELL_URLS = [
  "./",
  "index.html",
  "js/offline-media-core.js",
  "js/offline-media.js",
  "js/launch.js",
  "vendor/aframe.min.js",
  "assets/palm-energy-orb.png",
  "assets/cinematic-title.png",
].map((path) => new URL(path, self.registration.scope).toString());
const MEDIA_URLS = ["assets/space360.mp4", "assets/opening.mp4"].map((path) =>
  new URL(path, self.registration.scope).toString()
);

function notify(client, message) {
  if (client && typeof client.postMessage === "function") client.postMessage(message);
}

async function cacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const matches = await Promise.all(MEDIA_URLS.map((url) => cache.match(url)));
  return matches.every(Boolean);
}

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_URLS);
}

function mediaSize(response) {
  const type = response.headers.get("content-type") || "";
  const size = Number(response.headers.get("content-length"));
  if (!response.ok || !type.includes("video") || !Number.isFinite(size) || size < MINIMUM_MEDIA_BYTES) {
    throw new Error("Fail media tidak tersedia sebagai MP4. Semak penerbitan GitHub Pages.");
  }
  return size;
}

async function mediaManifest() {
  return Promise.all(
    MEDIA_URLS.map(async (url) => {
      const response = await fetch(url, { method: "HEAD", cache: "reload" });
      return { url, size: mediaSize(response) };
    })
  );
}

async function cacheMedia(client) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const media = await mediaManifest();
    const totalBytes = media.reduce((sum, item) => sum + item.size, 0);
    let loadedBytes = 0;
    let completed = 0;
    for (const item of media) {
      const response = await fetch(item.url, { cache: "reload" });
      const size = mediaSize(response);
      if (!response.body) throw new Error("Aliran muat turun filem tidak tersedia.");

      const [cacheBody, progressBody] = response.body.tee();
      const cachePromise = cache.put(
        item.url,
        new Response(cacheBody, { status: response.status, statusText: response.statusText, headers: response.headers })
      );
      const reader = progressBody.getReader();
      let fileBytes = 0;
      let lastReported = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileBytes += value.byteLength;
        if (fileBytes - lastReported >= 1024 * 1024 || fileBytes === size) {
          lastReported = fileBytes;
          notify(client, { type: "offline-media-progress", completed, loadedBytes: loadedBytes + fileBytes, totalBytes });
        }
      }
      await cachePromise;
      loadedBytes += fileBytes;
      completed += 1;
      notify(client, { type: "offline-media-progress", completed, loadedBytes, totalBytes });
    }
    notify(client, { type: "offline-media-complete" });
  } catch (error) {
    notify(client, { type: "offline-media-error", message: error.message });
  }
}

async function cachedMediaResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);
  if (!cached) return fetch(request);

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) return cached;

  const bytes = await cached.arrayBuffer();
  const range = OfflineMediaCore.parseRangeHeader(rangeHeader, bytes.byteLength);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${bytes.byteLength}` },
    });
  }

  const headers = new Headers(cached.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  return new Response(bytes.slice(range.start, range.end + 1), { status: 206, headers });
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "offline-media-prepare") event.waitUntil(cacheMedia(event.source));
  if (event.data?.type === "offline-media-status") {
    event.waitUntil(
      cacheStatus().then((ready) => notify(event.source, { type: "offline-media-status", ready }))
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (MEDIA_URLS.includes(event.request.url)) {
    event.respondWith(cachedMediaResponse(event.request));
    return;
  }

  if (SHELL_URLS.includes(shellCacheKey(event.request)) || event.request.mode === "navigate") {
    event.respondWith(cachedShellResponse(event.request));
  }
});
