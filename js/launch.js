/* =============================================================
   VR Peluncuran — launch interaction & ceremony effects
   Peluncuran Buku Himpunan Amalan Terbaik Pengetua & Guru Besar
   PRIME – Jejak Impak · JPN Perak · 30 September 2026
   ============================================================= */

const SIMULATE_VR = ["1", "true"].includes(
  (new URLSearchParams(window.location.search).get("simulateVR") || "").toLowerCase()
);

/* ---------- Small WebAudio helper (no audio files needed) ---------- */
const SFX = (() => {
  let ctx = null;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone({ freq = 440, dur = 0.15, type = "sine", gain = 0.2, slideTo = null }) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  }

  function ceremonialLaunch() {
    const ac = ensure();
    if (!ac) return;

    const now = ac.currentTime;
    const master = ac.createGain();
    const dry = ac.createGain();
    const wet = ac.createGain();
    const reverb = ac.createConvolver();
    const impulse = ac.createBuffer(2, Math.ceil(ac.sampleRate * 1.8), ac.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const decay = Math.pow(1 - i / data.length, 3.4);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    reverb.buffer = impulse;
    master.gain.setValueAtTime(0.52, now);
    dry.gain.setValueAtTime(0.78, now);
    wet.gain.setValueAtTime(0.16, now);
    master.connect(dry).connect(ac.destination);
    master.connect(reverb).connect(wet).connect(ac.destination);

    // Five soft glass notes form an uplifting Cmaj9 motif.
    [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((frequency, index) => {
      const start = now + index * 0.075;
      const duration = 1.35 + index * 0.08;
      const fundamental = ac.createOscillator();
      const overtone = ac.createOscillator();
      const fundamentalGain = ac.createGain();
      const overtoneGain = ac.createGain();

      fundamental.type = "sine";
      overtone.type = "sine";
      fundamental.frequency.setValueAtTime(frequency, start);
      overtone.frequency.setValueAtTime(frequency * 2.01, start);
      fundamentalGain.gain.setValueAtTime(0.0001, start);
      fundamentalGain.gain.exponentialRampToValueAtTime(0.14 - index * 0.012, start + 0.018);
      fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      overtoneGain.gain.setValueAtTime(0.0001, start);
      overtoneGain.gain.exponentialRampToValueAtTime(0.035, start + 0.012);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.58);

      fundamental.connect(fundamentalGain).connect(master);
      overtone.connect(overtoneGain).connect(master);
      fundamental.start(start);
      overtone.start(start);
      fundamental.stop(start + duration + 0.03);
      overtone.stop(start + duration * 0.6);
    });

    // A very quiet harmonic bed lets the notes resolve smoothly into the film.
    [261.63, 392, 493.88].forEach((frequency) => {
      const pad = ac.createOscillator();
      const padGain = ac.createGain();
      pad.type = "sine";
      pad.frequency.setValueAtTime(frequency, now + 0.22);
      padGain.gain.setValueAtTime(0.0001, now + 0.22);
      padGain.gain.exponentialRampToValueAtTime(0.026, now + 0.5);
      padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);
      pad.connect(padGain).connect(master);
      pad.start(now + 0.22);
      pad.stop(now + 2);
    });
  }

  return {
    hover() {
      tone({ freq: 988, dur: 0.09, type: "sine", gain: 0.025 });
    },
    launch() {
      ceremonialLaunch();
    },
  };
})();


/* Rehearsal tuning via URL, e.g. index.html?orbScale=1.15&filmAudio=0
   orbScale  — orb size multiplier; match the orb on the LED to the film's first frame.
   filmAudio — the headset plays the film with sound; filmAudio=0 mutes it. */
const URL_PARAMS = new URLSearchParams(window.location.search);
const ORB_SCALE = Math.min(2, Math.max(0.5, parseFloat(URL_PARAMS.get("orbScale")) || 1));
const FILM_AUDIO = !["0", "false"].includes((URL_PARAMS.get("filmAudio") || "").toLowerCase());

const easeInQuad = (t) => t * t;
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function srgbTexture(texture) {
  if (THREE.SRGBColorSpace && "colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* Canvas texture helper for soft procedural glows. */
function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = srgbTexture(new THREE.CanvasTexture(canvas));
  texture.needsUpdate = true;
  return texture;
}

function additiveMaterial(map, opacity) {
  return new THREE.MeshBasicMaterial({
    map,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
}

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function curvedScreenGeometry(radius, height, arc, segments = 72) {
  const thetaLength = THREE.MathUtils.degToRad(arc);
  return new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    segments,
    1,
    true,
    Math.PI - thetaLength / 2,
    thetaLength
  );
}

/* A quiet curved backing surface that follows the video arc. */
AFRAME.registerComponent("curved-panel", {
  schema: {
    radius: { default: 5.86 },
    height: { default: 4.36 },
    arc: { default: 73.5 },
    color: { type: "color", default: "#04060e" },
    opacity: { default: 1 },
  },
  init() {
    const geometry = curvedScreenGeometry(this.data.radius, this.data.height, this.data.arc);
    const material = new THREE.MeshBasicMaterial({
      color: this.data.color,
      opacity: this.data.opacity,
      transparent: this.data.opacity < 1,
      side: THREE.BackSide,
      depthWrite: true,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D("mesh", this.mesh);
  },
  update() {
    if (!this.mesh) return;
    this.mesh.material.color.set(this.data.color);
    this.mesh.material.opacity = this.data.opacity;
    this.mesh.material.transparent = this.data.opacity < 1;
    this.mesh.material.needsUpdate = true;
  },
  remove() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    this.el.removeObject3D("mesh");
  },
});

/* A real cylindrical video surface; its UVs are corrected for an inside view. */
AFRAME.registerComponent("curved-video", {
  schema: {
    src: { type: "selector" },
    radius: { default: 5.8 },
    height: { default: 4.1 },
    arc: { default: 72 },
    opacity: { default: 0 },
  },
  init() {
    const video = this.data.src;
    if (!video) return;

    this.texture = new THREE.VideoTexture(video);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.repeat.x = -1;
    this.texture.offset.x = 1;
    if (THREE.SRGBColorSpace && "colorSpace" in this.texture) {
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }

    const geometry = curvedScreenGeometry(this.data.radius, this.data.height, this.data.arc, 80);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      opacity: this.data.opacity,
      transparent: true,
      side: THREE.BackSide,
      toneMapped: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D("mesh", this.mesh);
  },
  update() {
    if (!this.mesh) return;
    this.mesh.material.opacity = this.data.opacity;
  },
  remove() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if (this.texture) this.texture.dispose();
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   sky-yaw — turn the galaxy with the ceremony anchor, so the Milky
   Way always crosses behind the orb as it does in the film
   ============================================================= */
AFRAME.registerComponent("sky-yaw", {
  init() {
    this.onLocked = (event) => {
      this.el.object3D.rotation.y = event.detail.yaw;
    };
    this.el.sceneEl.addEventListener("standby-locked", this.onLocked);
  },
  remove() {
    this.el.sceneEl.removeEventListener("standby-locked", this.onLocked);
  },
});

/* =============================================================
   galaxy-stars — crisp twinkling stars as GPU points (the baked sky
   texture only carries the soft nebula light)
   ============================================================= */
AFRAME.registerComponent("galaxy-stars", {
  schema: {
    count: { default: 2600 },
    radius: { default: 350 },
    seed: { default: 20260930 },
  },
  init() {
    const rand = seededRandom(this.data.seed);
    const count = this.data.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkle = new Float32Array(count);
    const color = new THREE.Color();
    const palette = ["#f4f6ff", "#cddcff", "#ffe7c2"];

    for (let i = 0; i < count; ) {
      const y = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Denser along the Milky Way, sparse elsewhere.
      const across = window.SkyBand ? window.SkyBand.coords(x, y, z).across : 1;
      if (rand() > 0.3 + 0.7 * Math.exp(-Math.pow(across / 0.3, 2))) continue;

      const i3 = i * 3;
      positions[i3] = x * this.data.radius;
      positions[i3 + 1] = y * this.data.radius;
      positions[i3 + 2] = z * this.data.radius;
      const roll = rand();
      color.set(palette[roll > 0.9 ? 2 : roll > 0.6 ? 1 : 0]);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      sizes[i] = 1.1 + Math.pow(rand(), 7) * 3.6;
      phases[i] = rand() * Math.PI * 2;
      twinkle[i] = rand() > 0.45 ? 0.6 + rand() * 2.2 : 0;
      i++;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkle, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelScale: { value: 1 } },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelScale;
        attribute float aSize;
        attribute float aPhase;
        attribute float aTwinkle;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float size = aSize * uPixelScale;
          gl_PointSize = max(1.5, size);
          float flicker = 0.5 + 0.5 * sin(uTime * aTwinkle + aPhase);
          vAlpha = mix(1.0, flicker, step(0.01, aTwinkle)) * min(1.0, size / 1.5);
          vColor = color;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 1.8);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -2;
    this.el.setObject3D("mesh", this.points);
  },
  tick(time) {
    const renderer = this.el.sceneEl.renderer;
    this.material.uniforms.uTime.value = time / 1000;
    this.material.uniforms.uPixelScale.value =
      renderer && renderer.xr.isPresenting ? 1.7 : Math.min(window.devicePixelRatio || 1, 2);
  },
  remove() {
    if (this.points) {
      this.points.geometry.dispose();
      this.material.dispose();
    }
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   galaxy-sky — the baked galaxy texture on an inside-facing sphere,
   with the Milky Way's light slowly flowing like drifting cloud.
   The sky itself never moves (moving the whole sky makes VR users
   feel they are moving); only its brightness is modulated.
   ============================================================= */
const SKY_NOISE_GLSL = `
  float skyHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float skyNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(skyHash(i), skyHash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(skyHash(i + vec3(0.0, 1.0, 0.0)), skyHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(skyHash(i + vec3(0.0, 0.0, 1.0)), skyHash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(skyHash(i + vec3(0.0, 1.0, 1.0)), skyHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
`;

AFRAME.registerComponent("galaxy-sky", {
  schema: {
    src: { type: "selector" },
    radius: { default: 400 },
    flow: { default: 0.7 },
    speed: { default: 3 },
  },
  init() {
    const image = this.data.src;
    const texture = srgbTexture(new THREE.Texture(image));
    if (image && image.complete) texture.needsUpdate = true;
    else if (image) image.addEventListener("load", () => (texture.needsUpdate = true), { once: true });

    this.uniforms = {
      uTime: { value: 0 },
      uFlow: { value: this.data.flow },
      uSpeed: { value: this.data.speed },
    };
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uFlow = this.uniforms.uFlow;
      shader.uniforms.uSpeed = this.uniforms.uSpeed;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSkyDir;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSkyDir = normalize(position);");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform float uTime;\nuniform float uFlow;\nuniform float uSpeed;\nvarying vec3 vSkyDir;\n${SKY_NOISE_GLSL}`)
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float ft = uTime * uSpeed;
          vec3 flowPos = vSkyDir * 3.2 + vec3(ft * 0.021, ft * -0.013, ft * 0.009);
          float n = skyNoise(flowPos) * 0.62 + skyNoise(flowPos * 2.4 + vec3(7.1, -3.3, 1.7) - ft * 0.017) * 0.38;
          // Only the nebula and Milky Way breathe; the deep blue background stays calm.
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
          float mask = smoothstep(0.012, 0.07, lum);
          diffuseColor.rgb *= 1.0 + (n - 0.5) * uFlow * mask;`
        );
    };

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.data.radius, 64, 32), material);
    this.mesh.renderOrder = -3;
    this.mesh.frustumCulled = false;
    this.el.setObject3D("mesh", this.mesh);
  },
  update() {
    if (!this.uniforms) return;
    this.uniforms.uFlow.value = this.data.flow;
    this.uniforms.uSpeed.value = this.data.speed;
  },
  tick(time) {
    this.uniforms.uTime.value = time / 1000;
  },
  remove() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   shooting-stars — gold-white meteors that all fall the same way,
   from upper right to lower left, like a real meteor shower seen from
   the ground. A big shower opens the scene about a second after the
   orb appears (so the guest sees it before touching the orb), then
   single meteors every few seconds and another shower now and then.
   No meteor path crosses the orb. Paused once launched.
   ============================================================= */
AFRAME.registerComponent("shooting-stars", {
  schema: {
    radius: { default: 300 },
    pool: { default: 20 },
    // Direction of fall: right to left, this many degrees below the horizon,
    // measured at each meteor's own spot in the sky so all look parallel.
    fallAngle: { default: 55 },
    minGap: { default: 3000 },
    maxGap: { default: 6000 },
    showerMinGap: { default: 18000 },
    showerMaxGap: { default: 28000 },
    showerSize: { default: 9 },
    openingShowerSize: { default: 14 },
    firstShower: { default: 1000 },
    avoidOrb: { default: 26 },
  },
  init() {
    const texture = canvasTexture(256, 16, (ctx, w, h) => {
      const pixels = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const vy = Math.exp(-Math.pow((y - h / 2 + 0.5) / (h * 0.2), 2));
        for (let x = 0; x < w; x++) {
          const u = x / (w - 1); // 0 = tail, 1 = head
          const tail = Math.pow(u, 0.45);
          const head = Math.exp(-Math.pow((1 - u) / 0.035, 2)) * 1.6;
          const v = Math.min(1, vy * (tail + head));
          const i = (y * w + x) * 4;
          pixels.data[i] = 255 * v;
          pixels.data[i + 1] = 240 * v;
          pixels.data[i + 2] = 205 * v;
          pixels.data[i + 3] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
    });

    this.meteors = Array.from({ length: this.data.pool }, () => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), additiveMaterial(texture, 0));
      mesh.visible = false;
      mesh.renderOrder = -2;
      mesh.frustumCulled = false;
      this.el.object3D.add(mesh);
      return {
        mesh,
        active: false,
        start: new THREE.Vector3(),
        axis: new THREE.Vector3(),
        born: 0,
        duration: 1000,
        travel: 0.25,
        length: 24,
      };
    });
    this.forward = new THREE.Vector3().fromArray(window.SkyBand ? window.SkyBand.forward : [0, -0.34, -0.94]);
    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.queue = [];
    this.nextSingle = -1;
    this.nextShower = -1;
    this.opening = true;
    this.kickoffPending = true;
    this._pos = new THREE.Vector3();
    this._x = new THREE.Vector3();
    this._y = new THREE.Vector3();
    this._z = new THREE.Vector3();
    this._m = new THREE.Matrix4();

    // Restart the opening shower whenever the ceremony locks in front of a
    // new wearer (headset handed over, or reset with Esc).
    this.onLocked = () => (this.kickoffPending = true);
    this.el.sceneEl.addEventListener("standby-locked", this.onLocked);
  },
  gap(min, max) {
    return min + Math.random() * (max - min);
  },
  kickoff(time) {
    this.kickoffPending = false;
    this.queue.length = 0;
    this.opening = true;
    this.nextShower = time + this.data.firstShower;
    this.nextSingle = this.nextShower + 3000;
  },
  /* One meteor falling along the shared direction, starting somewhere in the
     sky in front of the wearer (so the LED audience sees it), with a path that
     stays clear of the orb. Returns null if no clear path was found. */
  planMeteor(shower) {
    const DEG = Math.PI / 180;
    const avoid = this.data.avoidOrb * DEG;
    for (let tries = 0; tries < 24; tries++) {
      // Within the view of a wearer looking down at the orb (~22° below level).
      const az = (Math.random() * 2 - 1) * 70 * DEG;
      const el = (-12 + Math.random() * 40) * DEG;
      const start = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      // Local right/up on the sky at this point; fall leftward and down at the
      // same angle everywhere, so every meteor looks parallel to the others.
      const right = new THREE.Vector3().crossVectors(start, this.worldUp).normalize();
      const up = new THREE.Vector3().crossVectors(right, start).normalize();
      const fall = this.data.fallAngle * DEG;
      const tangent = right.multiplyScalar(-Math.cos(fall)).addScaledVector(up, -Math.sin(fall)).normalize();
      const axis = new THREE.Vector3().crossVectors(start, tangent).normalize();
      const travel = (shower ? 11 + Math.random() * 10 : 14 + Math.random() * 10) * DEG;
      let clear = true;
      for (let f = 0; f <= 1.001; f += 0.25) {
        const p = start.clone().applyAxisAngle(axis, travel * f);
        if (p.angleTo(this.forward) < avoid) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      return {
        start,
        axis,
        travel,
        duration: shower ? 750 + Math.random() * 550 : 1000 + Math.random() * 700,
        length: shower ? 30 + Math.random() * 45 : 45 + Math.random() * 35,
      };
    }
    return null;
  },
  planShower(time, size) {
    const count = size + Math.floor(Math.random() * 4);
    let at = time;
    for (let i = 0; i < count; i++) {
      at += 90 + Math.random() * 240;
      const meteor = this.planMeteor(true);
      if (meteor) this.queue.push(Object.assign({ at }, meteor));
    }
  },
  spawn(meteor, time, plan) {
    meteor.start.copy(plan.start);
    meteor.axis.copy(plan.axis);
    meteor.travel = plan.travel;
    meteor.duration = plan.duration;
    meteor.length = plan.length;
    meteor.born = time;
    meteor.active = true;
    meteor.mesh.visible = true;
  },
  tick(time) {
    const launched = this.el.sceneEl.is("launched");

    if (launched) {
      this.queue.length = 0;
    } else {
      if (this.kickoffPending || this.nextSingle < 0) this.kickoff(time);
      if (time >= this.nextSingle) {
        const meteor = this.planMeteor(false);
        if (meteor) this.queue.push(Object.assign({ at: time }, meteor));
        this.nextSingle = time + this.gap(this.data.minGap, this.data.maxGap);
      }
      if (time >= this.nextShower) {
        this.planShower(time, this.opening ? this.data.openingShowerSize : this.data.showerSize);
        this.opening = false;
        this.nextShower = time + this.gap(this.data.showerMinGap, this.data.showerMaxGap);
        // Let the shower breathe before the next single meteor.
        this.nextSingle = Math.max(this.nextSingle, time + 4000);
      }
      for (let i = this.queue.length - 1; i >= 0; i--) {
        if (this.queue[i].at > time) continue;
        const plan = this.queue.splice(i, 1)[0];
        const free = this.meteors.find((m) => !m.active);
        if (free) this.spawn(free, time, plan);
      }
    }

    for (const meteor of this.meteors) {
      if (!meteor.active) continue;
      const p = (time - meteor.born) / meteor.duration;
      if (p >= 1 || launched) {
        meteor.active = false;
        meteor.mesh.visible = false;
        continue;
      }
      // Head position on the sky sphere, and its direction of travel.
      this._pos.copy(meteor.start).applyAxisAngle(meteor.axis, meteor.travel * p);
      this._x.crossVectors(meteor.axis, this._pos).normalize();
      this._z.copy(this._pos).negate();
      this._y.crossVectors(this._z, this._x);
      this._m.makeBasis(this._x, this._y, this._z);
      meteor.mesh.quaternion.setFromRotationMatrix(this._m);

      const grow = Math.min(1, p * 3.2);
      const len = meteor.length * (0.35 + 0.65 * grow);
      meteor.mesh.scale.set(len, 3, 1);
      meteor.mesh.position
        .copy(this._pos)
        .multiplyScalar(this.data.radius)
        .addScaledVector(this._x, -len / 2);
      meteor.mesh.material.opacity = Math.min(1, p / 0.12) * (1 - Math.pow(p, 2.5)) * 0.85;
    }
  },
  remove() {
    this.el.sceneEl.removeEventListener("standby-locked", this.onLocked);
    this.meteors.forEach((m) => {
      this.el.object3D.remove(m.mesh);
      m.mesh.geometry.dispose();
    });
    if (this.meteors[0]) {
      this.meteors[0].mesh.material.map.dispose();
      this.meteors.forEach((m) => m.mesh.material.dispose());
    }
  },
});

/* =============================================================
   space-dust — faint motes drifting 2–12 m around the wearer for
   depth in the headset. Random slow drift (no uniform flow, which
   would feel like travelling). Fades out once the film starts so
   nothing floats in front of the screen.
   ============================================================= */
AFRAME.registerComponent("space-dust", {
  schema: {
    count: { default: 900 },
    extent: { default: 26 },
  },
  init() {
    const rand = seededRandom(7717);
    const count = this.data.count;
    const S = this.data.extent;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (rand() - 0.5) * S;
      positions[i3 + 1] = (rand() - 0.5) * S;
      positions[i3 + 2] = (rand() - 0.5) * S;
      velocity[i3] = (rand() - 0.5) * 0.26;
      velocity[i3 + 1] = (rand() - 0.5) * 0.14 + 0.03;
      velocity[i3 + 2] = (rand() - 0.5) * 0.26;
      sizes[i] = 0.035 + Math.pow(rand(), 3) * 0.06;
      phases[i] = rand() * Math.PI * 2;
      color.set(rand() > 0.65 ? "#fcecc6" : "#cddcff");
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aVelocity", new THREE.BufferAttribute(velocity, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.opacity = 1;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uFocal: { value: 900 },
        uExtent: { value: S },
        uCenter: { value: new THREE.Vector3() },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uFocal;
        uniform float uExtent;
        uniform vec3 uCenter;
        attribute vec3 aVelocity;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          // Wrap each mote inside a box that travels with the wearer.
          vec3 local = mod(position + aVelocity * uTime - uCenter + uExtent * 0.5, uExtent) - uExtent * 0.5;
          vec3 world = uCenter + local;
          vec4 mvPosition = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float dist = length(local);
          gl_PointSize = clamp(aSize * uFocal / max(0.1, -mvPosition.z), 1.0, 6.0);
          float band = smoothstep(2.0, 4.0, dist) * (1.0 - smoothstep(9.0, 12.5, dist));
          vAlpha = band * (0.55 + 0.4 * sin(uTime * 0.9 + aPhase));
          vColor = color;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          gl_FragColor = vec4(vColor, pow(1.0 - d, 1.6) * vAlpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.el.setObject3D("mesh", this.points);
  },
  tick(time, delta) {
    const scene = this.el.sceneEl;
    const u = this.material.uniforms;
    u.uTime.value = time / 1000;
    if (scene.camera) scene.camera.getWorldPosition(u.uCenter.value);
    const renderer = scene.renderer;
    u.uFocal.value = renderer && renderer.xr.isPresenting ? 1100 : 900;
    const target = scene.is("launched") ? 0 : 1;
    const step = Math.min(1, (delta || 16) / 400);
    this.opacity += (target - this.opacity) * step;
    u.uOpacity.value = this.opacity;
    this.points.visible = this.opacity > 0.01;
  },
  remove() {
    if (this.points) {
      this.points.geometry.dispose();
      this.material.dispose();
    }
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   ceremony-orb — the golden crystal orb, in the colours of the first
   frame of Peluncuran.mp4, built as a true volume so it reads as a
   solid object from any angle and in stereo:
   - the inside is ray-marched per eye: a white-hot core, warm inner
     glow and swirling gold filaments at real depths inside the glass
   - the glass surface carries a gold rim, world-fixed highlights and a
     reflection of the galaxy, all shaded from each eye's position
   - gold motes orbit through the volume; a soft halo and the lens
     streak finish the look
   Nothing inside the orb is a flat billboard any more.
   ============================================================= */
const ORB_SHELL_VERTEX = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Shared rim/highlight terms. rho: distance from the orb's centre as seen by
// this eye (1 = silhouette); the band brightens toward the outer ~12% of the
// radius, as measured on the film's first frame (158–178px of 178px).
const ORB_GLASS_GLSL = `
  uniform vec3 uRimColor;
  uniform vec3 uSpecColor;
  uniform vec3 uLight1;
  uniform vec3 uLight2;
  uniform float uStrength;
  uniform float uBoost;
  vec3 glassSurface(vec3 N, vec3 V) {
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float edge = 1.0 - ndv;
    float rho = sqrt(1.0 - ndv * ndv);
    float band = smoothstep(0.86, 1.0, rho);
    float rim = band * band * 0.95 + smoothstep(0.55, 0.95, rho) * 0.12;
    vec3 R = reflect(-V, N);
    float spec = pow(max(dot(R, uLight1), 0.0), 26.0) * 1.1 + pow(max(dot(R, uLight2), 0.0), 18.0) * 0.7;
    spec *= smoothstep(0.2, 0.7, edge);
    return uRimColor * rim + uSpecColor * spec;
  }
`;

// Far side of the glass, seen through the orb (rim only, dimmer).
const ORB_BACK_FRAGMENT = `
  ${ORB_GLASS_GLSL}
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    // Inward normal: three.js flips the winding for BackSide, so gl_FrontFacing
    // cannot tell the far side apart.
    vec3 N = -normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    gl_FragColor = vec4(glassSurface(N, V) * uStrength * (1.0 + uBoost * 0.8), 1.0);
  }
`;

const ORB_VOLUME_FRAGMENT = `
  ${ORB_GLASS_GLSL}
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform sampler2D uSky;
  uniform float uSkyYaw;
  uniform float uHasSky;
  uniform vec3 uCoreColor;
  uniform vec3 uInnerColor;
  uniform vec3 uGoldColor;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  float orbHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float orbNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(orbHash(i), orbHash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(orbHash(i + vec3(0.0, 1.0, 0.0)), orbHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(orbHash(i + vec3(0.0, 0.0, 1.0)), orbHash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(orbHash(i + vec3(0.0, 1.0, 1.0)), orbHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  // The galaxy reflected in the glass (same equirect mapping as galaxy-sky).
  vec3 skyReflection(vec3 d) {
    float c = cos(uSkyYaw), s = sin(uSkyYaw);
    d = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    float theta = acos(clamp(d.y, -1.0, 1.0));
    float phi = atan(d.z, -d.x);
    vec2 uv = vec2(fract(phi / 6.2831853), 1.0 - theta / 3.1415927);
    return pow(texture2D(uSky, uv).rgb, vec3(0.4545));
  }

  void main() {
    // A ray from THIS eye through the orb, in orb units (radius 1).
    vec3 rd = normalize(vWorldPosition - cameraPosition);
    vec3 oc = (cameraPosition - uCenter) / uRadius;
    float b = dot(oc, rd);
    float h = b * b - (dot(oc, oc) - 1.0);
    if (h <= 0.0) discard;
    h = sqrt(h);
    float t0 = max(-b - h, 0.0);
    float t1 = -b + h;
    const int STEPS = 18;
    float dt = (t1 - t0) / float(STEPS);
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

    vec3 inside = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = oc + rd * (t0 + (float(i) + jitter) * dt);
      float r2 = dot(p, p);
      float r = sqrt(r2);
      // Differential swirl: the inside turns faster than the outside.
      float a = uTime * 0.35 + (1.0 - r) * 2.4;
      float ca = cos(a), sa = sin(a);
      vec3 q = vec3(ca * p.x - sa * p.z, p.y, sa * p.x + ca * p.z);
      float n = orbNoise(q * 4.8 + vec3(0.0, uTime * 0.12, 0.0)) * 0.6 + orbNoise(q * 11.0 - uTime * 0.2) * 0.4;
      float filaments = pow(smoothstep(0.48, 0.85, n), 2.2) * (1.0 - smoothstep(0.8, 1.0, r));
      float core = exp(-r2 * 16.0);
      float glow = exp(-r2 * 2.6);
      inside += (uCoreColor * core * 4.2 + uInnerColor * glow * 0.45 + uGoldColor * filaments * 2.4) * dt;
    }

    vec3 N = normalize(vWorldNormal);
    vec3 V = -rd;
    float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
    vec3 reflection = uHasSky * skyReflection(reflect(rd, N)) * (0.03 + 0.6 * pow(edge, 3.0));

    vec3 color = inside * (1.0 + uBoost * 1.2) + (glassSurface(N, V) * uStrength) * (1.0 + uBoost * 0.8) + reflection;
    gl_FragColor = vec4(color, 1.0);
  }
`;

AFRAME.registerComponent("ceremony-orb", {
  schema: {
    diameter: { default: 0.38 },
    motes: { default: 700 },
  },
  init() {
    const D = this.data.diameter;
    const R = D / 2;
    this.shellRadius = R * 1.035;
    this.boost = 0;
    this.cameraPosition = new THREE.Vector3();
    this.worldQuaternion = new THREE.Quaternion();
    this.worldScale = new THREE.Vector3();
    this.light1 = new THREE.Vector3(-0.6, 0.62, 0.5).normalize();
    this.light2 = new THREE.Vector3(0.66, -0.52, 0.52).normalize();
    this.skyEl = this.el.sceneEl.querySelector("#sky");
    this.billboard = new THREE.Group();
    this.el.object3D.add(this.billboard);

    // Soft halo around the glass
    const glowTexture = canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(252,236,198,0.0)");
      g.addColorStop(0.28, "rgba(236,190,120,0.10)");
      g.addColorStop(0.35, "rgba(215,166,109,0.24)");
      g.addColorStop(0.46, "rgba(170,120,70,0.08)");
      g.addColorStop(0.75, "rgba(120,90,60,0.02)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(D * 3, D * 3), additiveMaterial(glowTexture, 0.9));
    this.billboard.add(this.glow);

    const streakTexture = canvasTexture(1024, 64, (ctx, w, h) => {
      const pixels = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const vy = Math.exp(-Math.pow((y - h / 2 + 0.5) / (h * 0.09), 2));
        for (let x = 0; x < w; x++) {
          const u = Math.abs(x - w / 2 + 0.5) / (w / 2);
          const v = vy * (0.75 * Math.exp(-u * 4.2) + 0.25 * Math.exp(-u * 1.3)) * (1 - u);
          const i = (y * w + x) * 4;
          pixels.data[i] = 255 * v;
          pixels.data[i + 1] = 222 * v;
          pixels.data[i + 2] = 160 * v;
          pixels.data[i + 3] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
    });
    // In front of the glass, like a flare on the camera lens.
    this.streak = new THREE.Mesh(new THREE.PlaneGeometry(D * 5.2, D * 0.1), additiveMaterial(streakTexture, 0.5));
    this.streak.position.z = R * 1.1;
    this.billboard.add(this.streak);

    const glassUniforms = (strength) => ({
      uRimColor: { value: new THREE.Color(0.92, 0.58, 0.22) },
      uSpecColor: { value: new THREE.Color(1.0, 0.94, 0.8) },
      uLight1: { value: new THREE.Vector3() },
      uLight2: { value: new THREE.Vector3() },
      uStrength: { value: strength },
      uBoost: { value: 0 },
    });
    const shellGeometry = new THREE.SphereGeometry(this.shellRadius, 64, 48);

    this.shellBack = new THREE.Mesh(
      shellGeometry,
      new THREE.ShaderMaterial({
        uniforms: glassUniforms(0.35),
        vertexShader: ORB_SHELL_VERTEX,
        fragmentShader: ORB_BACK_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.shellBack.renderOrder = 1;
    this.el.object3D.add(this.shellBack);

    this.volume = new THREE.Mesh(
      shellGeometry,
      new THREE.ShaderMaterial({
        uniforms: Object.assign(glassUniforms(1), {
          uTime: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uRadius: { value: this.shellRadius },
          uSky: { value: null },
          uSkyYaw: { value: 0 },
          uHasSky: { value: 0 },
          uCoreColor: { value: new THREE.Color(1.0, 0.98, 0.92) },
          uInnerColor: { value: new THREE.Color(0.95, 0.66, 0.32) },
          uGoldColor: { value: new THREE.Color(0.95, 0.6, 0.22) },
        }),
        vertexShader: ORB_SHELL_VERTEX,
        fragmentShader: ORB_VOLUME_FRAGMENT,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.volume.renderOrder = 3;
    this.el.object3D.add(this.volume);

    this.motes = this.createMotes(D);
    this.motes.renderOrder = 2;
    this.el.object3D.add(this.motes);
  },
  createMotes(D) {
    const rand = seededRandom(3303);
    const count = this.data.motes;
    const maxRadius = D * 0.47;
    const radius = new Float32Array(count);
    const theta = new Float32Array(count);
    const height = new Float32Array(count);
    const speed = new Float32Array(count);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Fill the whole volume (slightly denser toward the core).
      const r = maxRadius * Math.pow(rand(), 0.42);
      const lat = Math.asin(rand() * 2 - 1);
      radius[i] = r * Math.cos(lat);
      height[i] = r * Math.sin(lat);
      theta[i] = rand() * Math.PI * 2;
      // Inner motes orbit faster, like the swirl in the film.
      speed[i] = (0.22 + rand() * 0.3) * (1.5 - r / maxRadius);
      const sparkle = rand() > 0.94;
      sizes[i] = sparkle ? 0.005 + rand() * 0.003 : 0.0016 + Math.pow(rand(), 2.5) * 0.0034;
      phases[i] = rand() * Math.PI * 2;
      color.set(sparkle ? "#fcfbf1" : rand() > 0.5 ? "#fcecc6" : "#d7a66d");
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    geometry.setAttribute("aTheta", new THREE.BufferAttribute(theta, 1));
    geometry.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.moteMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uFocal: { value: 900 } },
      vertexShader: `
        uniform float uTime;
        uniform float uFocal;
        attribute float aRadius;
        attribute float aTheta;
        attribute float aHeight;
        attribute float aSpeed;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float angle = aTheta + uTime * aSpeed;
          vec3 p = vec3(cos(angle) * aRadius, aHeight + sin(uTime * 0.6 + aPhase) * 0.004, sin(angle) * aRadius);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(aSize * uFocal / max(0.05, -mvPosition.z), 1.0, 9.0);
          vAlpha = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 2.1 + aPhase * 3.0));
          vColor = color;
        }
      `,
      fragmentShader: `
        uniform float uBoost;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 1.6);
          gl_FragColor = vec4(vColor * (1.0 + uBoost), glow * vAlpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    const points = new THREE.Points(geometry, this.moteMaterial);
    points.frustumCulled = false;
    return points;
  },
  /* 0 = idle; rises toward ~1.5 while the orb swells on launch. */
  setBoost(boost) {
    this.boost = boost;
  },
  tick(time) {
    const t = time / 1000;
    const camera = this.el.sceneEl.camera;
    if (camera) {
      camera.getWorldPosition(this.cameraPosition);
      this.billboard.lookAt(this.cameraPosition);
    }
    const b = this.boost;
    this.streak.material.opacity = 0.46 + 0.06 * Math.sin(t * 0.8 + 1.3) + b * 0.5;
    this.glow.material.opacity = 0.9 + 0.08 * Math.sin(t * 1.15) + b * 0.6;

    // Highlights are fixed to the ceremony (not the head), so they shift as
    // the wearer moves, like light on real glass.
    const object = this.el.object3D;
    object.getWorldQuaternion(this.worldQuaternion);
    object.getWorldScale(this.worldScale);
    for (const shell of [this.shellBack, this.volume]) {
      const u = shell.material.uniforms;
      u.uLight1.value.copy(this.light1).applyQuaternion(this.worldQuaternion);
      u.uLight2.value.copy(this.light2).applyQuaternion(this.worldQuaternion);
      u.uBoost.value = b;
    }
    const v = this.volume.material.uniforms;
    v.uTime.value = t;
    object.getWorldPosition(v.uCenter.value);
    v.uRadius.value = this.shellRadius * this.worldScale.x;
    if (!v.uSky.value) {
      const sky = this.el.sceneEl.querySelector("[galaxy-sky]");
      const skyMesh = sky && sky.components["galaxy-sky"] && sky.components["galaxy-sky"].mesh;
      if (skyMesh && skyMesh.material.map && skyMesh.material.map.image) {
        v.uSky.value = skyMesh.material.map;
        v.uHasSky.value = 1;
      }
    }
    if (this.skyEl) v.uSkyYaw.value = this.skyEl.object3D.rotation.y;

    this.moteMaterial.uniforms.uTime.value = t;
    this.moteMaterial.uniforms.uBoost.value = b;
    const renderer = this.el.sceneEl.renderer;
    this.moteMaterial.uniforms.uFocal.value = renderer && renderer.xr.isPresenting ? 1100 : 900;
  },
  remove() {
    this.el.object3D.remove(this.billboard);
    this.el.object3D.remove(this.motes);
    this.el.object3D.remove(this.shellBack);
    this.el.object3D.remove(this.volume);
    [this.glow, this.streak].forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.map.dispose();
      mesh.material.dispose();
    });
    this.volume.geometry.dispose();
    this.shellBack.material.dispose();
    this.volume.material.dispose();
    this.motes.geometry.dispose();
    this.moteMaterial.dispose();
  },
});

/* =============================================================
   title-card — the JPN Perak emblem and the launch title, set in real
   fonts (Cinzel, Montserrat; OFL, bundled in assets/fonts) on a canvas
   texture above the orb. Hidden behind the flash when the film starts.
   ============================================================= */
const TITLE_LINES = {
  ministry: ["KEMENTERIAN PENDIDIKAN", "JABATAN PENDIDIKAN NEGERI PERAK"],
  kicker: "PELUNCURAN",
  book: "BUKU HIMPUNAN AMALAN TERBAIK PENGETUA & GURU BESAR PRIME",
  title: "JEJAK IMPAK",
};

const TITLE_FONTS = [
  ["Cinzel", "assets/fonts/Cinzel-VariableFont_wght.ttf", "400 900"],
  ["Montserrat", "assets/fonts/Montserrat-VariableFont_wght.ttf", "100 900"],
];

function loadTitleFonts() {
  if (!window.FontFace || !document.fonts) return Promise.resolve();
  return Promise.all(
    TITLE_FONTS.map(([family, url, weight]) =>
      new FontFace(family, `url(${url})`, { weight })
        .load()
        .then((face) => document.fonts.add(face))
        .catch(() => {})
    )
  );
}

/* Draw text with extra letter spacing, centred on x (canvas letterSpacing is
   not available in every browser). */
function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + spacing;
  });
  return total;
}

function spacedWidth(ctx, text, spacing) {
  return [...text].reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * ([...text].length - 1);
}

AFRAME.registerComponent("title-card", {
  schema: {
    logo: { type: "selector" },
    width: { default: 4.6 }, // metres
  },
  init() {
    this.mesh = null;
    const logo = this.data.logo;
    const logoReady =
      !logo || logo.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            logo.addEventListener("load", resolve, { once: true });
            logo.addEventListener("error", resolve, { once: true });
          });
    Promise.all([loadTitleFonts(), logoReady]).then(() => this.build());

    this.onLaunchCut = () => this.el.setAttribute("visible", false);
    this.onReset = () => this.el.setAttribute("visible", true);
    this.el.sceneEl.addEventListener("film-cut", this.onLaunchCut);
    this.el.sceneEl.addEventListener("ceremony-reset", this.onReset);
  },
  build() {
    const W = 2400;
    const H = 1120;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const cx = W / 2;
    const gold = (y0, y1) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, "#fcecc6");
      g.addColorStop(0.45, "#e6bd7a");
      g.addColorStop(1, "#c4935a");
      return g;
    };
    ctx.textBaseline = "alphabetic";

    // Emblem
    let y = 20;
    const logo = this.data.logo;
    if (logo && logo.naturalWidth) {
      const logoH = 400;
      const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
      ctx.drawImage(logo, cx - logoW / 2, y, logoW, logoH);
      y += logoH;
    }

    // Ministry / state department, as under the emblem in the JPN logo
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 46px Montserrat, sans-serif";
    y += 70;
    drawSpacedText(ctx, TITLE_LINES.ministry[0], cx, y, 3);
    y += 62;
    drawSpacedText(ctx, TITLE_LINES.ministry[1], cx, y, 3);

    // Gold divider
    y += 64;
    const line = ctx.createLinearGradient(cx - 420, 0, cx + 420, 0);
    line.addColorStop(0, "rgba(215,166,109,0)");
    line.addColorStop(0.5, "rgba(236,196,130,0.95)");
    line.addColorStop(1, "rgba(215,166,109,0)");
    ctx.fillStyle = line;
    ctx.fillRect(cx - 420, y, 840, 3);
    ctx.save();
    ctx.translate(cx, y + 1.5);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#e6bd7a";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();

    // Line 1: PELUNCURAN
    y += 110;
    ctx.font = "600 72px Cinzel, serif";
    ctx.shadowColor = "rgba(215,166,109,0.55)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = gold(y - 60, y);
    drawSpacedText(ctx, TITLE_LINES.kicker, cx, y, 22);

    // Line 2: the book, one line, fitted to the card
    y += 110;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "#fbf6ea";
    let size = 64;
    ctx.font = `600 ${size}px Montserrat, sans-serif`;
    while (size > 30 && spacedWidth(ctx, TITLE_LINES.book, 3) > W - 120) {
      size -= 1;
      ctx.font = `600 ${size}px Montserrat, sans-serif`;
    }
    drawSpacedText(ctx, TITLE_LINES.book, cx, y, 3);

    // Line 3: JEJAK IMPAK
    y += 230;
    ctx.font = "700 196px Cinzel, serif";
    ctx.shadowColor = "rgba(236,190,120,0.75)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = gold(y - 160, y);
    drawSpacedText(ctx, TITLE_LINES.title, cx, y, 16);
    ctx.shadowBlur = 0;

    const texture = srgbTexture(new THREE.CanvasTexture(canvas));
    const renderer = this.el.sceneEl.renderer;
    if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    const height = (this.data.width * H) / W;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.data.width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      })
    );
    this.el.setObject3D("mesh", this.mesh);
  },
  remove() {
    this.el.sceneEl.removeEventListener("film-cut", this.onLaunchCut);
    this.el.sceneEl.removeEventListener("ceremony-reset", this.onReset);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.map.dispose();
      this.mesh.material.dispose();
      this.el.removeObject3D("mesh");
    }
  },
});

/* =============================================================
   launch-flash — head-locked white-gold flash that hides the cut
   from the orb to the film (and cues the LED operator)
   ============================================================= */
AFRAME.registerComponent("launch-flash", {
  init() {
    const texture = canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.72);
      g.addColorStop(0, "#fffcf2");
      g.addColorStop(0.45, "#fdf0cf");
      g.addColorStop(1, "#f0c878");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      })
    );
    this.mesh.renderOrder = 1000;
    this.mesh.visible = false;
    this.el.setObject3D("mesh", this.mesh);
  },
  setOpacity(opacity) {
    this.mesh.material.opacity = opacity;
    this.mesh.visible = opacity > 0.001;
  },
  remove() {
    this.mesh.geometry.dispose();
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   standby-anchor - re-centre after the headset is moved, wait for
   the new wearer to settle, then lock the ceremony in the room
   ============================================================= */
AFRAME.registerComponent("standby-anchor", {
  schema: {
    moveThreshold: { default: 0.42 },
    stableDuration: { default: 800 },
    interactionDelay: { default: 300 },
  },
  init() {
    this.camera = null;
    this.cameraPosition = new THREE.Vector3();
    this.cameraQuaternion = new THREE.Quaternion();
    this.anchorQuaternion = new THREE.Quaternion();
    this.cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
    this.up = new THREE.Vector3(0, 1, 0);
    this.samplePosition = new THREE.Vector3();
    this.lockedCameraPosition = new THREE.Vector3();
    this.sampleYaw = 0;
    this.lastSampleTime = 0;
    this.stableSince = 0;
    this.relocating = false;
    this.locked = false;
    this.readyTimer = null;
    this.xrSession = null;
    this.simulateVR = SIMULATE_VR;
    this.inVR = this.simulateVR || Boolean(
      this.el.sceneEl.is("vr-mode") ||
      (this.el.sceneEl.renderer && this.el.sceneEl.renderer.xr.isPresenting)
    );

    this.onEnterVR = () => {
      this.inVR = true;
      this.bindXRSession();
      this.beginRelocation();
    };
    this.onExitVR = () => {
      clearTimeout(this.readyTimer);
      this.unbindXRSession();
      this.inVR = this.simulateVR;
      this.relocating = false;
      this.locked = false;
      this.el.setAttribute("visible", true);
      this.el.sceneEl.addState("standby-ready");
    };
    this.onRecenter = () => this.beginRelocation();
    this.onVisibilityChange = () => {
      if (document.hidden) {
        this.lockInteraction();
      } else if (this.inVR) {
        this.beginRelocation();
      }
    };
    this.onXRVisibilityChange = () => {
      if (this.xrSession && this.xrSession.visibilityState === "visible") {
        this.beginRelocation();
      } else {
        this.lockInteraction();
      }
    };

    this.el.sceneEl.addEventListener("enter-vr", this.onEnterVR);
    this.el.sceneEl.addEventListener("exit-vr", this.onExitVR);
    this.el.sceneEl.addEventListener("recenter-standby", this.onRecenter);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    if (this.simulateVR) this.beginRelocation();
  },
  lockInteraction() {
    clearTimeout(this.readyTimer);
    this.el.sceneEl.removeState("standby-ready");
    this.el.sceneEl.emit("cancel-launch-hold");
  },
  bindXRSession() {
    this.unbindXRSession();
    const scene = this.el.sceneEl;
    this.xrSession =
      scene.xrSession ||
      (scene.renderer && scene.renderer.xr.getSession && scene.renderer.xr.getSession());
    if (this.xrSession) {
      this.xrSession.addEventListener("visibilitychange", this.onXRVisibilityChange);
    }
  },
  unbindXRSession() {
    if (this.xrSession) {
      this.xrSession.removeEventListener("visibilitychange", this.onXRVisibilityChange);
      this.xrSession = null;
    }
  },
  updateCameraPose() {
    const scene = this.el.sceneEl;
    if (!this.camera) this.camera = scene.camera && scene.camera.el;
    if (!this.camera || !this.camera.object3D) return false;

    this.camera.object3D.getWorldPosition(this.cameraPosition);
    this.camera.object3D.getWorldQuaternion(this.cameraQuaternion);
    this.cameraRotation.setFromQuaternion(this.cameraQuaternion, "YXZ");
    this.anchorQuaternion.setFromAxisAngle(this.up, this.cameraRotation.y);
    return true;
  },
  alignToCamera() {
    if (!this.updateCameraPose()) return false;

    this.el.object3D.position.copy(this.cameraPosition);
    this.el.object3D.quaternion.copy(this.anchorQuaternion);
    return true;
  },
  beginRelocation() {
    if (this.el.sceneEl.is("launched")) return;
    this.lockInteraction();
    this.relocating = true;
    this.locked = false;
    this.lastSampleTime = 0;
    this.stableSince = 0;
    this.el.removeAttribute("animation__settle");
    this.el.setAttribute("scale", "1 1 1");
    this.el.setAttribute("visible", false);
  },
  lockAtCurrentPose() {
    if (!this.alignToCamera()) return;
    this.lockedCameraPosition.copy(this.cameraPosition);
    this.relocating = false;
    this.locked = true;
    this.el.sceneEl.emit("standby-locked", { yaw: this.cameraRotation.y });
    this.el.setAttribute("visible", true);
    this.el.setAttribute("scale", "0.965 0.965 0.965");
    this.el.removeAttribute("animation__settle");
    this.el.setAttribute("animation__settle", {
      property: "scale",
      from: "0.965 0.965 0.965",
      to: "1 1 1",
      dur: 520,
      easing: "easeOutCubic",
    });
    clearTimeout(this.readyTimer);
    this.readyTimer = setTimeout(() => {
      if (!this.relocating && !this.el.sceneEl.is("launched")) {
        this.el.sceneEl.addState("standby-ready");
      }
    }, this.data.interactionDelay);
  },
  tick(time) {
    const scene = this.el.sceneEl;
    if (!scene || scene.is("launched")) return;

    // Quest can begin presenting before its scene state is observable here.
    // Trust the WebXR renderer as a second, independent immersive signal.
    if (!this.inVR && scene.renderer && scene.renderer.xr.isPresenting) {
      this.inVR = true;
      this.bindXRSession();
      this.beginRelocation();
      return;
    }

    // Desktop preview remains centred continuously; immersive VR uses locking.
    if (!this.inVR) {
      this.alignToCamera();
      this.el.setAttribute("visible", true);
      scene.addState("standby-ready");
      return;
    }

    if (time - this.lastSampleTime < 80 || !this.updateCameraPose()) return;

    if (this.relocating) {
      this.el.object3D.position.copy(this.cameraPosition);
      this.el.object3D.quaternion.copy(this.anchorQuaternion);

      if (!this.lastSampleTime) {
        this.samplePosition.copy(this.cameraPosition);
        this.sampleYaw = this.cameraRotation.y;
        this.stableSince = time;
      } else {
        const positionDelta = this.cameraPosition.distanceTo(this.samplePosition);
        const yawDelta = Math.abs(
          Math.atan2(
            Math.sin(this.cameraRotation.y - this.sampleYaw),
            Math.cos(this.cameraRotation.y - this.sampleYaw)
          )
        );

        if (positionDelta < 0.018 && yawDelta < 0.03) {
          if (!this.stableSince) this.stableSince = time;
        } else {
          this.stableSince = 0;
        }

        this.samplePosition.copy(this.cameraPosition);
        this.sampleYaw = this.cameraRotation.y;

        if (this.stableSince && time - this.stableSince >= this.data.stableDuration) {
          this.lockAtCurrentPose();
        }
      }
    } else if (!this.locked) {
      this.lockAtCurrentPose();
    } else if (this.cameraPosition.distanceTo(this.lockedCameraPosition) > this.data.moveThreshold) {
      this.beginRelocation();
    }

    this.lastSampleTime = time;
  },
  remove() {
    clearTimeout(this.readyTimer);
    this.unbindXRSession();
    this.el.sceneEl.removeState("standby-ready");
    this.el.sceneEl.removeEventListener("enter-vr", this.onEnterVR);
    this.el.sceneEl.removeEventListener("exit-vr", this.onExitVR);
    this.el.sceneEl.removeEventListener("recenter-standby", this.onRecenter);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },
});

/* =============================================================
   touch-launch — launch when a controller or a tracked hand
   physically reaches/touches the orb (in addition to the laser)
   ============================================================= */
AFRAME.registerComponent("touch-launch", {
  schema: {
    threshold: { default: 0.34 },
    holdDuration: { default: 600 },
  },
  init() {
    this.controllers = [];
    this.trackedHands = [];
    this._o = new THREE.Vector3();
    this._h = new THREE.Vector3();
    this._t = 0;
    this.armed = false;
    this.clearSince = 0;
    this.holdSince = 0;
    this.orbGroup = this.el.sceneEl.querySelector("#orbGroup");

    this.resolveInputs = this.resolveInputs.bind(this);
    this.onEnterVR = () => this.resolveInputs();
    this.cancelHold = () => this.resetHold();
    this.el.sceneEl.addEventListener("loaded", this.resolveInputs, { once: true });
    this.el.sceneEl.addEventListener("enter-vr", this.onEnterVR);
    this.el.sceneEl.addEventListener("cancel-launch-hold", this.cancelHold);
    this.resolveInputs();
  },
  resolveInputs() {
    const scene = this.el.sceneEl;
    this.controllers = ["#leftHand", "#rightHand"]
      .map((id) => scene.querySelector(id))
      .filter(Boolean);
    this.trackedHands = ["#leftHandTrack", "#rightHandTrack"]
      .map((id) => scene.querySelector(id))
      .filter(Boolean);
  },
  resetHold() {
    this.holdSince = 0;
    if (this.orbGroup && !this.el.sceneEl.is("launched")) {
      this.orbGroup.object3D.scale.setScalar(ORB_SCALE);
    }
  },
  setHoldProgress(progress) {
    if (!this.orbGroup) return;
    const eased = 1 - Math.pow(1 - progress, 2);
    this.orbGroup.object3D.scale.setScalar(ORB_SCALE * (1 + eased * 0.13));
  },
  isInside(position) {
    if (!this.el.object3D) return false;
    this.el.object3D.getWorldPosition(this._o);
    this._h.copy(position);
    return this._o.distanceTo(this._h) < this.data.threshold * ORB_SCALE;
  },
  tick(time) {
    // Throttle to ~every 80ms; stop checking once launched
    if (time - this._t < 80) return;
    this._t = time;
    const scene = this.el.sceneEl;
    if (scene.is("launched")) return;

    if (!scene.is("standby-ready")) {
      this.armed = false;
      this.clearSince = 0;
      this.resetHold();
      return;
    }

    if (!this.controllers.length && !this.trackedHands.length) this.resolveInputs();

    let hasTrackedInput = false;
    let inputInside = false;

    // Bare-hand tracking: test the real index fingertip, not the hand entity origin.
    for (const hand of this.trackedHands) {
      const tracking = hand.components["hand-tracking-controls"];
      if (!tracking || !tracking.hasPoses || !tracking.indexTipPosition) continue;
      hasTrackedInput = true;
      if (this.isInside(tracking.indexTipPosition)) {
        inputInside = true;
      }
    }

    // Physical controller proximity remains available as a fallback.
    for (const controller of this.controllers) {
      if (!controller.object3D || !controller.object3D.visible) continue;
      controller.object3D.getWorldPosition(this._h);
      if (this._h.lengthSq() === 0) continue;
      hasTrackedInput = true;
      if (this.isInside(this._h)) {
        inputInside = true;
      }
    }

    // Do not arm while a hand/controller is already inside the hidden collider.
    // The input must first be observed outside, then deliberately enter the orb.
    if (!this.armed) {
      this.resetHold();
      if (hasTrackedInput && !inputInside) {
        if (!this.clearSince) this.clearSince = time;
        if (time - this.clearSince >= 240) this.armed = true;
      } else {
        this.clearSince = 0;
      }
      return;
    }

    if (!inputInside) {
      this.resetHold();
      return;
    }

    if (!this.holdSince) this.holdSince = time;
    const progress = Math.min(1, (time - this.holdSince) / this.data.holdDuration);
    this.setHoldProgress(progress);
    if (progress >= 1) {
      scene.emit("launch");
    }
  },
  remove() {
    this.resetHold();
    this.el.sceneEl.removeEventListener("loaded", this.resolveInputs);
    this.el.sceneEl.removeEventListener("enter-vr", this.onEnterVR);
    this.el.sceneEl.removeEventListener("cancel-launch-hold", this.cancelHold);
  },
});

/* =============================================================
   launch-button — the clickable orb
   ============================================================= */
AFRAME.registerComponent("launch-button", {
  init() {
    this.el.addEventListener("mouseenter", () => {
      if (!this.el.sceneEl.is("standby-ready")) return;
      SFX.hover();
    });
    this.el.addEventListener("click", () => {
      if (!this.el.sceneEl.is("standby-ready")) return;
      this.el.sceneEl.emit("launch");
    });
  },
});

/* =============================================================
   orb-dissolve — single-draw-call GPU particles for the launch
   ============================================================= */
AFRAME.registerComponent("orb-dissolve", {
  schema: {
    count: { default: 420 },
    duration: { default: 1320 },
  },
  init() {
    const count = this.data.count;
    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const distances = new Float32Array(count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const z = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const radial = Math.sqrt(1 - z * z);
      const shellRadius = 0.035 + Math.pow(Math.random(), 0.5) * 0.22;

      positions[i3] = Math.cos(theta) * radial * shellRadius;
      positions[i3 + 1] = z * shellRadius;
      positions[i3 + 2] = Math.sin(theta) * radial * shellRadius * 0.72;

      const dx = Math.cos(theta) * radial + (Math.random() - 0.5) * 0.28;
      const dy = z * 0.72 + Math.random() * 0.42;
      const dz = Math.sin(theta) * radial * 0.55 - 0.28 - Math.random() * 0.22;
      const length = Math.hypot(dx, dy, dz) || 1;
      directions[i3] = dx / length;
      directions[i3 + 1] = dy / length;
      directions[i3 + 2] = dz / length;

      const paletteRoll = Math.random();
      if (paletteRoll > 0.82) color.set("#fcfbf1");
      else if (paletteRoll > 0.42) color.set("#fcecc6");
      else color.set("#d7a66d");
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = 0.018 + Math.pow(Math.random(), 1.6) * 0.045;
      phases[i] = Math.random() * Math.PI * 2;
      distances[i] = 0.55 + Math.pow(Math.random(), 0.72) * 1.65;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aDistance", new THREE.BufferAttribute(distances, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: `
        uniform float uProgress;
        uniform float uPixelRatio;
        attribute vec3 aDirection;
        attribute float aSize;
        attribute float aPhase;
        attribute float aDistance;
        varying vec3 vColor;
        varying float vEnergy;

        void main() {
          float eased = 1.0 - pow(1.0 - uProgress, 3.0);
          float arc = sin(3.14159265 * uProgress);
          float angle = aPhase + uProgress * (2.4 + aDistance);
          vec3 transformed = position + aDirection * aDistance * eased;
          transformed.x += cos(angle) * arc * (0.06 + aDistance * 0.10);
          transformed.y += sin(angle) * arc * (0.04 + aDistance * 0.065);
          transformed.y += uProgress * uProgress * (0.08 + aDistance * 0.12);

          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(aSize * 310.0 * uPixelRatio / max(1.0, -mvPosition.z), 2.0, 14.0);
          vColor = color;
          vEnergy = 1.0 - smoothstep(0.18, 1.0, uProgress);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vEnergy;

        void main() {
          float distanceToCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (distanceToCenter > 1.0) discard;
          float glow = pow(1.0 - distanceToCenter, 1.7);
          float core = smoothstep(0.42, 0.0, distanceToCenter);
          float alpha = (glow * 0.72 + core * 0.5) * uOpacity;
          gl_FragColor = vec4(vColor * (1.0 + core * 1.8 + vEnergy * 0.35), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.el.setObject3D("mesh", this.points);
    this.el.object3D.visible = false;
    this.active = false;
    this.elapsed = 0;
  },
  start(origin) {
    if (origin) this.el.object3D.position.copy(origin);
    this.elapsed = 0;
    this.active = true;
    this.material.uniforms.uProgress.value = 0;
    this.material.uniforms.uOpacity.value = 0;
    this.el.object3D.visible = true;
  },
  reset() {
    this.active = false;
    this.elapsed = 0;
    this.el.object3D.visible = false;
    this.material.uniforms.uProgress.value = 0;
    this.material.uniforms.uOpacity.value = 0;
  },
  tick(time, delta) {
    if (!this.active) return;
    this.elapsed += Math.min(delta || 0, 50);
    const progress = Math.min(1, this.elapsed / this.data.duration);
    const fadeIn = Math.min(1, progress / 0.08);
    const fadeOut = 1 - Math.max(0, (progress - 0.48) / 0.52);
    this.material.uniforms.uProgress.value = progress;
    this.material.uniforms.uOpacity.value = fadeIn * fadeOut;

    if (progress >= 1) this.reset();
  },
  remove() {
    if (this.points) {
      this.points.geometry.dispose();
      this.points.material.dispose();
    }
    this.el.removeObject3D("mesh");
  },
});

/* =============================================================
   launch-sequence — the ceremony choreography (on <a-scene>)

   Timeline after the orb is touched (ms):
     0–300     orb swells and brightens, gold motes burst outward
     60–300    white-gold flash rises to full (the LED operator's cue)
     300       behind the flash: orb hidden, sky dimmed, film screen shown
     420–1120  flash fades, revealing Peluncuran.mp4 in the headset
   Everything is driven from tick(): window.requestAnimationFrame does not
   run while the Quest is presenting an immersive session.
   ============================================================= */
const LAUNCH_TIMING = {
  swell: 300,
  flashStart: 60,
  cut: 300,
  flashHoldUntil: 420,
  flashFade: 700,
};

AFRAME.registerComponent("launch-sequence", {
  init() {
    this.fired = false;
    this.launchedAt = -1;
    this.cutDone = false;
    this.hasVideo = false;

    const scene = this.el;
    this.anchorEl = scene.querySelector("#ceremonyAnchor");
    this.orbGroup = scene.querySelector("#orbGroup");
    this.launchParticles = scene.querySelector("#launchParticles");
    this.flashEl = scene.querySelector("#launchFlash");
    this.screenVideo = scene.querySelector("#screenVideo");
    this.filmScreen = scene.querySelector("#filmScreen");
    this.dimmer = scene.querySelector("#dimmer");
    this.video = document.getElementById("openingVideo");
    this.hint = document.getElementById("hint");
    this.simulatorHint = document.getElementById("simulatorHint");
    if (this.simulatorHint && SIMULATE_VR) this.simulatorHint.hidden = false;
    if (this.orbGroup) this.orbGroup.object3D.scale.setScalar(ORB_SCALE);

    if (this.video) {
      this.video.muted = !FILM_AUDIO;
      this.video.addEventListener("error", () => {
        this.hasVideo = false;
      });
    }
    window.addEventListener("offline-media-ready", () => {
      this.hasVideo = Boolean(this.video?.src);
    });

    // Hide the operator notes the moment we go immersive
    scene.addEventListener("enter-vr", () => {
      if (this.hint) this.hint.style.display = "none";
      if (this.simulatorHint) this.simulatorHint.hidden = true;
    });
    scene.addEventListener("exit-vr", () => {
      if (this.hint) this.hint.style.display = "";
      if (this.simulatorHint && SIMULATE_VR) this.simulatorHint.hidden = false;
    });

    // Trigger from the orb
    scene.addEventListener("launch", () => this.launch());

    // Operator keys: Space/L launch, Esc return to the orb, R re-centre
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        this.resetToIdle();
        return;
      }
      if (e.code === "KeyR" && !this.fired) {
        e.preventDefault();
        scene.emit("recenter-standby");
        return;
      }
      if (e.code === "Space" || e.key.toLowerCase() === "l") {
        e.preventDefault();
        scene.emit("launch");
      }
    });
  },

  orb() {
    return this.orbGroup && this.orbGroup.components["ceremony-orb"];
  },

  flash(opacity) {
    const flash = this.flashEl && this.flashEl.components["launch-flash"];
    if (flash) flash.setOpacity(opacity);
  },

  /* The film is optional in the headset: the LED PC plays the ceremony film,
     so the orb always launches even if no local file was chosen. */
  launch() {
    if (this.fired) return;
    // An operator key can launch while the anchor is still re-centring (hidden).
    // Lock it where the wearer is looking now, or the film screen inside it stays
    // hidden: the anchor stops updating once launched.
    const anchor = this.anchorEl && this.anchorEl.components["standby-anchor"];
    if (anchor && !anchor.locked) anchor.lockAtCurrentPose();

    this.fired = true;
    this.cutDone = false;
    this.launchedAt = -1;
    this.el.addState("launched");
    this.el.removeState("standby-ready");
    if (this.hint) this.hint.style.display = "none";

    SFX.launch();

    // Start decoding now, inside the user gesture; the orb holds still for the
    // film's first 3 s, so starting 0.3 s early is invisible.
    if (this.hasVideo && this.video) {
      try {
        this.video.currentTime = 0;
      } catch (e) {}
      this.playFilm();
    }

    const dissolve = this.launchParticles && this.launchParticles.components["orb-dissolve"];
    if (dissolve && this.orbGroup) {
      const origin = new THREE.Vector3();
      this.orbGroup.object3D.getWorldPosition(origin);
      dissolve.start(origin);
    }
  },

  /* A failed play() must not cost us the film: keep the screen (it shows the
     orb frame while paused) and retry. A bare-hand touch is not a user gesture;
     sound normally still plays because the operator already tapped the page
     (choosing the file, Enter VR). If the browser refuses sound anyway, play
     muted rather than freeze. */
  playFilm() {
    const video = this.video;
    if (!video || !this.fired || !video.paused) return;
    const p = video.play();
    if (!p || !p.catch) return;
    p.catch((err) => {
      if (!this.fired) return;
      if (err && err.name === "NotAllowedError" && !video.muted) {
        video.muted = true;
        this.playFilm();
      } else {
        clearTimeout(this._playRetry);
        this._playRetry = setTimeout(() => this.playFilm(), 250);
      }
    });
  },

  tick(time) {
    if (!this.fired) return;
    if (this.launchedAt < 0) this.launchedAt = time;
    const t = time - this.launchedAt;
    const T = LAUNCH_TIMING;

    if (!this.cutDone) {
      const swell = easeInQuad(clamp01(t / T.swell));
      if (this.orbGroup) this.orbGroup.object3D.scale.setScalar(ORB_SCALE * (1 + swell * 0.55));
      const orb = this.orb();
      if (orb) orb.setBoost(swell * 1.5);
    }

    if (t < T.flashHoldUntil) {
      this.flash(easeInCubic(clamp01((t - T.flashStart) / (T.cut - T.flashStart))));
    } else {
      this.flash(1 - easeOutCubic(clamp01((t - T.flashHoldUntil) / T.flashFade)));
    }

    if (!this.cutDone && t >= T.cut) {
      this.cutDone = true;
      this.cutToFilm();
    }
  },

  cutToFilm() {
    this.el.emit("film-cut");
    if (this.orbGroup) this.orbGroup.object3D.visible = false;
    if (this.dimmer) {
      // Draw the dimmer over the stars (-2) but under the film screen (0).
      this.dimmer.object3D.traverse((o) => (o.renderOrder = -1));
      this.dimmer.setAttribute("material", "opacity", 0.85);
    }
    if (this.hasVideo && this.filmScreen && this.screenVideo) {
      this.filmScreen.setAttribute("visible", true);
      this.screenVideo.setAttribute("visible", true);
      this.screenVideo.setAttribute("curved-video", "opacity", 1);
      this.playFilm();
    }
  },

  /* Esc / operator: stop the film and bring the orb back for another take */
  resetToIdle() {
    if (!this.fired) return;
    this.fired = false;
    this.cutDone = false;
    clearTimeout(this._playRetry);
    this.flash(0);

    if (this.video) {
      try {
        this.video.pause();
        this.video.currentTime = 0;
      } catch (e) {}
      this.video.muted = !FILM_AUDIO;
    }
    if (this.screenVideo) {
      this.screenVideo.setAttribute("curved-video", "opacity", 0);
      this.screenVideo.setAttribute("visible", false);
    }
    if (this.filmScreen) this.filmScreen.setAttribute("visible", false);
    if (this.dimmer) this.dimmer.setAttribute("material", "opacity", 0);

    if (this.orbGroup) {
      this.orbGroup.object3D.scale.setScalar(ORB_SCALE);
      this.orbGroup.object3D.visible = true;
    }
    const orb = this.orb();
    if (orb) orb.setBoost(0);
    const dissolve = this.launchParticles && this.launchParticles.components["orb-dissolve"];
    if (dissolve) dissolve.reset();

    this.el.removeState("launched");
    this.el.emit("ceremony-reset");
    this.el.emit("recenter-standby");
    if (this.hint && !this.el.is("vr-mode")) this.hint.style.display = "";
  },
});
