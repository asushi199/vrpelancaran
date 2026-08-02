const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shows an operator-controlled offline preparation action", () => {
  const html = read("index.html");
  assert.match(html, /id="prepareOfflineButton"/);
  assert.match(html, /src="js\/offline-media\.js/);
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

test("service worker caches media and serves MP4 byte ranges", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /skipWaiting\(\)/);
  assert.match(worker, /cache\.put/);
  assert.match(worker, /Content-Range/);
  assert.match(worker, /parseRangeHeader/);
  assert.match(worker, /MINIMUM_MEDIA_BYTES/);
  assert.match(worker, /content-length/);
});
