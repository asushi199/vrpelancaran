/* Generates assets/sky-galaxy.ppm: a 360° equirectangular deep-blue galaxy sky
   matching the first frame of Peluncuran.mp4 (diagonal Milky Way band, blue-purple
   nebula). Bright stars are drawn at runtime as GPU points (see galaxy-stars in
   js/launch.js), so this texture only carries the soft, low-frequency light.

   Usage: node tools/make-sky.js [width]   (then tools/make-assets.sh converts to JPG)

   Pixel → direction uses the same mapping as THREE.SphereGeometry, so the image
   can be applied to an inside-facing A-Frame sphere with no extra rotation. */
const fs = require("node:fs");
const path = require("node:path");
const band = require("../js/sky-band.js");

const W = Number(process.argv[2]) || 4096;
const H = W / 2;

/* ---------- Seeded Perlin noise (Ken Perlin's improved noise) ---------- */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260930);
const perm = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u),
      lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w
  );
}
function fbm(x, y, z, octaves, offset = 0) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq + offset, y * freq + offset * 1.7, z * freq - offset);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum; // roughly -0.5..0.5
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- Palette (sRGB 0..1), measured from Orb_firstframe_final.png ---------- */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const DEEP = hex("#040c1b"); // darkest corners
const BASE = hex("#081730"); // background around the orb
const LIFT = hex("#0f2348"); // blue lift near the band
const NEBULA_BLUE = hex("#2b4f9c");
const NEBULA_VIOLET = hex("#5b4f9e");
const BAND_CORE = hex("#9a95c8");

const img = Buffer.alloc(W * H * 3);
const started = Date.now();
for (let y = 0; y < H; y++) {
  const theta = ((y + 0.5) / H) * Math.PI;
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  for (let x = 0; x < W; x++) {
    const phi = ((x + 0.5) / W) * Math.PI * 2;
    // THREE.SphereGeometry vertex mapping
    const dx = -Math.cos(phi) * sinT;
    const dy = cosT;
    const dz = Math.sin(phi) * sinT;

    const { across, along } = band.coords(dx, dy, dz);
    const f = 2.2;
    const warp = fbm(dx * f, dy * f, dz * f, 4, 11.3);
    const wobble = across + warp * 0.22;

    // Core band + a wide, soft halo
    const core = Math.exp(-Math.pow(wobble / 0.2, 2));
    const halo = Math.exp(-Math.pow(wobble / 0.5, 2));

    // Cloudy structure and dark dust lanes inside the band
    const clouds = 0.45 + fbm(dx * 4.5, dy * 4.5, dz * 4.5, 6, 3.1) * 1.9;
    const dust = smooth(0.02, 0.24, fbm(dx * 9, dy * 9, dz * 9, 4, 7.7) + Math.abs(wobble) * 0.25);
    const grain = Math.max(0, noise(dx * 260, dy * 260, dz * 260)) * 2.2 + Math.max(0, noise(dx * 90, dy * 90, dz * 90)) * 0.8;
    const bandLight = core * Math.max(0, clouds) * (1 - dust * 0.62) * (0.8 + grain * 0.5);

    // Scattered faint nebula clouds away from the band
    const neb = Math.max(0, fbm(dx * 1.6, dy * 1.6, dz * 1.6, 4, 23.9) + 0.06) * 1.6;
    const nebHue = 0.5 + fbm(dx * 2.4, dy * 2.4, dz * 2.4, 3, 41.2);

    // Darker toward the zenith/nadir and far from the band, like the frame corners
    const vignette = smooth(0.0, 0.85, halo * 0.8 + (1 - Math.abs(dy)) * 0.35);
    const px = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      let v = lerp(DEEP[c], BASE[c], vignette);
      v = lerp(v, LIFT[c], halo * 0.55);
      v += neb * 0.12 * lerp(NEBULA_BLUE[c], NEBULA_VIOLET[c], nebHue);
      v += halo * 0.09 * lerp(NEBULA_BLUE[c], NEBULA_VIOLET[c], nebHue) * Math.max(0, clouds);
      v += bandLight * 0.32 * lerp(NEBULA_VIOLET[c], BAND_CORE[c], core * core);
      // ±0.5 LSB dither avoids banding in the dark gradients
      v = v * 255 + (rand() - 0.5);
      img[px + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  if (y % 256 === 0) process.stdout.write(`\r${Math.round((y / H) * 100)}%`);
}

const out = path.join(__dirname, "..", "assets", "sky-galaxy.ppm");
fs.writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]));
console.log(`\rWrote ${out} (${W}x${H}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
