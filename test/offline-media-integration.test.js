const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shows an operator-controlled local media preparation action", () => {
  const html = read("index.html");
  const offlineMedia = read("js/local-media.js");
  assert.match(html, /id="prepareOfflineButton"/);
  assert.match(html, /id="space360File"/);
  assert.match(html, /id="openingFile"/);
  assert.match(html, /src="js\/local-media\.js/);
  assert.match(offlineMedia, /URL\.createObjectURL/);
});

test("plays operator-selected Quest files instead of caching the films in the browser", () => {
  const html = read("index.html");
  const offlineMedia = read("js/local-media.js");
  const launch = read("js/launch.js");
  assert.match(html, /id="space360File"/);
  assert.match(html, /id="openingFile"/);
  assert.doesNotMatch(html, /id="v360"[\s\S]*?src="assets\/space360\.mp4"/);
  assert.match(offlineMedia, /URL\.createObjectURL/);
  assert.doesNotMatch(offlineMedia, /offline-media-prepare/);
  assert.match(launch, /offline-media-ready[\s\S]*?this\.hasVideo = Boolean\(this\.video\?\.src\)/);
});

test("prevents the ceremony launch before both media files are ready", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /VROfflineMedia\.isReady/);
  assert.match(launch, /offline-media-not-ready/);
});

test("waits to load the VR videos until offline preparation completes", () => {
  const html = read("index.html");
  const launch = read("js/launch.js");
  assert.match(html, /id="v360"[\s\S]*?preload="none"/);
  assert.match(html, /id="openingVideo"[\s\S]*?preload="none"/);
  assert.match(launch, /offline-media-ready/);
});

test("pauses the 360 background while the opening film plays, then resumes it", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /this\.v360\.pause\(\)[\s\S]*?this\.video\.play\(\)/);
  assert.match(launch, /finish\(\) \{[\s\S]*?this\.v360\.play\(\)/);
});

test("service worker caches only the lightweight app shell", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /skipWaiting\(\)/);
  assert.match(worker, /cache\.addAll\(SHELL_URLS\)/);
  assert.match(worker, /js\/local-media\.js/);
  assert.doesNotMatch(worker, /MEDIA_URLS/);
  assert.doesNotMatch(worker, /arrayBuffer\(\)/);
});

test("service worker keeps the VR app shell available after the headset goes offline", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /SHELL_URLS/);
  assert.match(worker, /cache\.addAll\(SHELL_URLS\)/);
  assert.match(worker, /event\.request\.mode === "navigate"/);
});

test("Pages deployment publishes the service worker at the site root", () => {
  const workflow = read(".github/workflows/pages.yml");
  assert.match(workflow, /cp index\.html \.nojekyll service-worker\.js _site\//);
});
