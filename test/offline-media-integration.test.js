const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shows an operator-controlled local film preparation action", () => {
  const html = read("index.html");
  const offlineMedia = read("js/local-media.js");
  assert.match(html, /id="prepareOfflineButton"/);
  assert.match(html, /id="filmFile"/);
  assert.match(html, /src="js\/local-media\.js/);
  assert.match(offlineMedia, /URL\.createObjectURL/);
});

test("plays the operator-selected Quest file instead of caching the film in the browser", () => {
  const html = read("index.html");
  const offlineMedia = read("js/local-media.js");
  const launch = read("js/launch.js");
  assert.doesNotMatch(html, /id="openingVideo"[^>]*src=/);
  assert.doesNotMatch(offlineMedia, /offline-media-prepare/);
  assert.match(launch, /offline-media-ready[\s\S]*?this\.hasVideo = Boolean\(this\.video\?\.src\)/);
});

test("drops the old 360 video background for the baked galaxy sky", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /id="v360"/);
  assert.doesNotMatch(html, /space360/);
  assert.match(html, /src="assets\/sky-galaxy\.jpg"/);
  assert.match(html, /src="assets\/orb-interior\.png"/);
});

test("the orb launches even without a local film (the LED PC plays the film)", () => {
  const launch = read("js/launch.js");
  assert.doesNotMatch(launch, /offline-media-not-ready/);
  assert.doesNotMatch(launch, /VROfflineMedia\.isReady/);
});

test("waits to load the film until the operator picks it, and plays it with sound by default", () => {
  const html = read("index.html");
  const launch = read("js/launch.js");
  assert.match(html, /id="openingVideo"[\s\S]*?preload="none"/);
  assert.doesNotMatch(html, /id="openingVideo"[^>]*\smuted/);
  assert.match(launch, /const FILM_AUDIO = !\["0", "false"\]/);
  assert.match(launch, /this\.video\.muted = !FILM_AUDIO/);
});

test("the orb has a real 3D glass shell shaded per eye", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /new THREE\.SphereGeometry\(R \* 1\.035/);
  assert.match(launch, /cameraPosition - vWorldPosition/);
});

test("animations run from tick(), which keeps working during an immersive WebXR session", () => {
  const launch = read("js/launch.js");
  assert.doesNotMatch(launch, /requestAnimationFrame\(/);
  assert.match(launch, /launch-sequence[\s\S]*?tick\(time\)/);
});

test("a refused play() keeps the film screen and retries (hand touch is not a user gesture)", () => {
  const launch = read("js/launch.js");
  assert.doesNotMatch(launch, /catch\(\(\) => \(this\.hasVideo = false\)\)/);
  assert.match(launch, /NotAllowedError[\s\S]*?video\.muted = true/);
});

test("an operator launch during re-centring locks the anchor so the screen can show", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /if \(anchor && !anchor\.locked\) anchor\.lockAtCurrentPose\(\)/);
});

test("service worker caches only the lightweight app shell", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /skipWaiting\(\)/);
  assert.match(worker, /cache\.addAll\(SHELL_URLS\)/);
  assert.match(worker, /js\/local-media\.js/);
  assert.match(worker, /js\/sky-band\.js/);
  assert.match(worker, /assets\/sky-galaxy\.jpg/);
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
