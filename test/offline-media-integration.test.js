const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shows an operator-controlled offline preparation action", () => {
  const html = read("index.html");
  const offlineMedia = read("js/offline-media.js");
  assert.match(html, /id="prepareOfflineButton"/);
  assert.match(html, /id="offlineMediaProgress"/);
  assert.match(html, /src="js\/offline-media\.js/);
  assert.match(offlineMedia, /loadedBytes/);
  assert.match(offlineMedia, /totalBytes/);
  assert.match(offlineMedia, /progressBar\.value/);
});

test("prevents the ceremony launch before both media files are ready", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /VROfflineMedia\.isReady/);
  assert.match(launch, /offline-media-not-ready/);
});

test("waits to load the VR videos until offline preparation completes", () => {
  const html = read("index.html");
  const launch = read("js/launch.js");
  assert.match(html, /id="v360"[\s\S]*?preload="metadata"/);
  assert.match(html, /id="openingVideo"[\s\S]*?preload="metadata"/);
  assert.match(launch, /offline-media-ready/);
});

test("pauses the 360 background while the opening film plays, then resumes it", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /this\.v360\.pause\(\)[\s\S]*?this\.video\.play\(\)/);
  assert.match(launch, /finish\(\) \{[\s\S]*?this\.v360\.play\(\)/);
});

test("service worker caches media and serves MP4 byte ranges", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /skipWaiting\(\)/);
  assert.match(worker, /cache\.put/);
  assert.match(worker, /Content-Range/);
  assert.match(worker, /parseRangeHeader/);
  assert.match(worker, /MINIMUM_MEDIA_BYTES/);
  assert.match(worker, /content-length/);
  assert.match(worker, /body\.tee\(\)/);
  assert.match(worker, /loadedBytes/);
  assert.match(worker, /totalBytes/);
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
