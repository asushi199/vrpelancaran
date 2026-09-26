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

test("the orb is a ray-marched volume shaded per eye, with no flat billboards inside", () => {
  const launch = read("js/launch.js");
  const html = read("index.html");
  assert.match(launch, /new THREE\.SphereGeometry\(this\.shellRadius/);
  assert.match(launch, /vec3 rd = normalize\(vWorldPosition - cameraPosition\)/);
  assert.match(launch, /for \(int i = 0; i < STEPS; i\+\+\)/);
  assert.doesNotMatch(html, /orb-interior\.png|orb-sprite\.png/);
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

test("a meteor shower opens the scene right after the orb appears", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /firstShower: \{ default: 1000 \}/);
  assert.match(launch, /this\.opening \? this\.data\.openingShowerSize : this\.data\.showerSize/);
  assert.match(launch, /addEventListener\("standby-locked", this\.onLocked\)/);
});

test("all meteors fall the same way (upper right to lower left), clear of the orb", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /fallAngle: \{ default: 55 \}/);
  assert.match(launch, /const tangent = right\.multiplyScalar\(-Math\.cos\(fall\)\)\.addScaledVector\(up, -Math\.sin\(fall\)\)/);
  assert.doesNotMatch(launch, /radiant/);
});

test("the title card shows the JPN emblem and the three launch lines in real fonts", () => {
  const launch = read("js/launch.js");
  const html = read("index.html");
  assert.match(html, /src="assets\/logo-jata-negara\.png"/);
  assert.match(html, /title-card="logo: #jpnLogo/);
  assert.match(launch, /kicker: "PELANCARAN"/);
  assert.doesNotMatch(launch, /PELUNCURAN/);
  assert.match(launch, /book: "BUKU HIMPUNAN AMALAN TERBAIK PENGETUA & GURU BESAR PRIME"/);
  assert.match(launch, /title: "Jejak Impak"/);
  assert.match(launch, /assets\/fonts\/KaushanScript-Regular\.ttf/);
  assert.match(launch, /ministry: \["KEMENTERIAN PENDIDIKAN", "JABATAN PENDIDIKAN NEGERI PERAK"\]/);
  assert.match(launch, /assets\/fonts\/Cinzel-VariableFont_wght\.ttf/);
  assert.match(launch, /this\.el\.emit\("film-cut"\)/);
});

test("the title is layered in depth, with JEJAK IMPAK as extruded gold letters and a light sweep", () => {
  const launch = read("js/launch.js");
  assert.match(launch, /const TITLE_DEPTH = \{ emblem: 0\.35, book: 0\.15, text: 0, title: -0\.2, glow: -0\.6 \}/);
  // Line 2 (the book) is the highlight, kept on one line; JEJAK IMPAK is smaller.
  assert.match(launch, /drawSpacedText\(b, TITLE_LINES\.book, BW \/ 2, bookBaselineInCanvas, 2\)/);
  assert.match(launch, /const titleSize = 129;/);
  assert.match(launch, /new THREE\.ExtrudeGeometry\(shapes/);
  assert.match(launch, /glyphs: \{ default: "assets\/fonts\/title-glyphs\.json" \}/);
  assert.match(launch, /shapes\.push\(brushSwoosh\(width, capHeight\)\)/);
  assert.match(launch, /metalness: 1/);
  assert.match(launch, /titleSweep\(time \/ 1000\)/);
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
