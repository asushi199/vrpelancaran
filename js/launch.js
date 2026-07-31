/* =============================================================
   Pelancaran VR — launch interaction & opening ceremony effects
   Program Sokongan Profesional: Dasar Pendidikan Digital
   ============================================================= */

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
  return {
    hover() {
      tone({ freq: 880, dur: 0.08, type: "triangle", gain: 0.08 });
    },
    click() {
      tone({ freq: 520, dur: 0.12, type: "square", gain: 0.15 });
    },
    launch() {
      // rising whoosh + shimmer
      tone({ freq: 180, slideTo: 1200, dur: 1.1, type: "sawtooth", gain: 0.22 });
      setTimeout(() => tone({ freq: 660, slideTo: 1760, dur: 0.9, type: "sine", gain: 0.14 }), 120);
    },
  };
})();

/* ---------- Generic tween helper for numeric attribute props ---------- */
function tweenProp(el, comp, prop, from, to, dur, done) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    el.setAttribute(comp, prop, from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
    else if (done) done();
  }
  requestAnimationFrame(step);
}

/* =============================================================
   sharp-video — disable mipmaps so 360 video stays crisp
   ============================================================= */
AFRAME.registerComponent("sharp-video", {
  init() {
    const apply = () => {
      const mesh = this.el.getObject3D("mesh");
      if (!mesh || !mesh.material || !mesh.material.map) return false;
      const tex = mesh.material.map;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      mesh.material.needsUpdate = true;
      return true;
    };
    if (!apply()) {
      this.el.addEventListener("materialtextureloaded", apply);
      // Video textures may bind a frame later
      const tryLater = setInterval(() => {
        if (apply()) clearInterval(tryLater);
      }, 200);
      setTimeout(() => clearInterval(tryLater), 8000);
    }
  },
});

/* =============================================================
   star-dust — gentle drifting light motes for atmosphere
   ============================================================= */
AFRAME.registerComponent("star-dust", {
  schema: {
    count: { default: 45 },
    radius: { default: 14 },
  },
  init() {
    const colors = ["#37b6ff", "#7fd0ff", "#d6ecff", "#2f83ff"];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < this.data.count; i++) {
      const p = document.createElement("a-sphere");
      const r = 1.5 + Math.random() * this.data.radius;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 4;
      // Bias particles toward the floor so they read as a rising tech field
      const y = 0.05 + Math.pow(Math.random(), 1.7) * 6;
      const col = colors[(Math.random() * colors.length) | 0];
      p.setAttribute("radius", 0.01 + Math.random() * 0.022);
      p.setAttribute("segments-width", 5);
      p.setAttribute("segments-height", 5);
      p.setAttribute(
        "material",
        `color: ${col}; emissive: ${col}; emissiveIntensity: 1.8; opacity: ${0.35 + Math.random() * 0.55}; transparent: true; fog: false`
      );
      p.setAttribute("position", `${x} ${y} ${z}`);
      const dur = 5000 + Math.random() * 8000;
      p.setAttribute("animation__float", {
        property: "position",
        to: `${x} ${y + 1.5 + Math.random() * 2.2} ${z}`,
        dir: "alternate",
        loop: true,
        dur,
        easing: "easeInOutSine",
      });
      p.setAttribute("animation__twinkle", {
        property: "material.opacity",
        to: 0.05,
        dir: "alternate",
        loop: true,
        dur: 1200 + Math.random() * 2000,
        easing: "easeInOutSine",
      });
      frag.appendChild(p);
    }
    this.el.appendChild(frag);
  },
});

/* =============================================================
   orbit-particles — small energy motes circling the launch core
   ============================================================= */
AFRAME.registerComponent("orbit-particles", {
  schema: {
    count: { default: 6 },
    radius: { default: 0.46 },
  },
  init() {
    for (let i = 0; i < this.data.count; i++) {
      // Each mote lives on its own tilted orbital plane, spinning at its own speed
      const plane = document.createElement("a-entity");
      const tiltX = Math.random() * 160 - 80;
      const tiltZ = Math.random() * 160 - 80;
      plane.setAttribute("rotation", `${tiltX} 0 ${tiltZ}`);

      const spinner = document.createElement("a-entity");
      spinner.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
      spinner.setAttribute("animation", {
        property: "rotation",
        to: `0 ${Math.random() * 360 + 360} 0`,
        loop: true,
        dur: 2600 + Math.random() * 2600,
        easing: "linear",
      });

      const dot = document.createElement("a-sphere");
      dot.setAttribute("radius", 0.016 + Math.random() * 0.012);
      dot.setAttribute("segments-width", 6);
      dot.setAttribute("segments-height", 6);
      dot.setAttribute("position", `${this.data.radius} 0 0`);
      dot.setAttribute(
        "material",
        "color: #dff0ff; emissive: #dff0ff; emissiveIntensity: 2.4; fog: false"
      );

      spinner.appendChild(dot);
      plane.appendChild(spinner);
      this.el.appendChild(plane);
    }
  },
});

/* =============================================================
   energy-orb-3d — compact true-3D launch orb with animated
   surface energy, volumetric glow and orbiting light tracks
   ============================================================= */
AFRAME.registerComponent("energy-orb-3d", {
  init() {
    const vertexShader = `
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `;

    const coreFragmentShader = `
      uniform float uTime;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vLocalPosition;

      void main() {
        float facing = clamp(dot(vNormalView, vViewDirection), 0.0, 1.0);
        float edge = pow(1.0 - facing, 1.7);
        float pulse = 0.92 + 0.08 * sin(uTime * 3.2);
        float ripple = 0.5 + 0.5 * sin(
          (vLocalPosition.x + vLocalPosition.y + vLocalPosition.z) * 42.0 - uTime * 4.0
        );
        vec3 whiteHot = vec3(1.0, 1.0, 1.0);
        vec3 cyan = vec3(0.12, 0.92, 1.0);
        vec3 color = mix(whiteHot, cyan, edge * 0.82);
        color *= pulse * (1.0 + ripple * 0.16);
        gl_FragColor = vec4(color, 0.84 + edge * 0.14);
      }
    `;

    const shellFragmentShader = `
      uniform float uTime;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vLocalPosition;

      void main() {
        float facing = clamp(dot(vNormalView, vViewDirection), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.1);
        float a = sin(vLocalPosition.x * 36.0 + vLocalPosition.y * 22.0 + uTime * 2.1);
        float b = sin(vLocalPosition.y * 33.0 - vLocalPosition.z * 27.0 - uTime * 1.7);
        float c = sin(vLocalPosition.z * 39.0 + vLocalPosition.x * 18.0 + uTime * 1.3);
        float filaments = smoothstep(1.55, 2.55, a + b + c);
        float shimmer = 0.88 + 0.12 * sin(uTime * 2.6);
        vec3 deepBlue = vec3(0.02, 0.22, 1.0);
        vec3 electricCyan = vec3(0.05, 0.92, 1.0);
        vec3 color = mix(deepBlue, electricCyan, fresnel + filaments * 0.65);
        color *= shimmer * (0.72 + fresnel * 1.35 + filaments * 1.8);
        float alpha = 0.12 + fresnel * 0.56 + filaments * 0.34;
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const haloFragmentShader = `
      uniform float uTime;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        float facing = abs(dot(normalize(vNormalView), normalize(vViewDirection)));
        float rim = pow(1.0 - facing, 2.6);
        float pulse = 0.86 + 0.14 * sin(uTime * 2.2);
        vec3 color = mix(vec3(0.01, 0.23, 1.0), vec3(0.18, 0.96, 1.0), rim);
        gl_FragColor = vec4(color * pulse * (0.45 + rim), rim * 0.3);
      }
    `;

    const shaderMaterial = (fragmentShader, side = THREE.FrontSide) =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side,
        toneMapped: false,
      });

    this.group = new THREE.Group();
    this.materials = [];
    this.geometries = [];
    this.rings = [];

    const addSphere = (radius, fragmentShader, side) => {
      const geometry = new THREE.SphereGeometry(radius, 48, 32);
      const material = shaderMaterial(fragmentShader, side);
      const mesh = new THREE.Mesh(geometry, material);
      this.geometries.push(geometry);
      this.materials.push(material);
      this.group.add(mesh);
      return mesh;
    };

    addSphere(0.115, coreFragmentShader, THREE.FrontSide);
    addSphere(0.172, shellFragmentShader, THREE.DoubleSide);
    addSphere(0.225, haloFragmentShader, THREE.BackSide);

    const ringAxes = [
      [Math.PI / 2.5, 0.2, 0],
      [0.25, Math.PI / 2.2, 0.8],
      [1.0, 0.55, Math.PI / 2.4],
    ];
    ringAxes.forEach((rotation, index) => {
      const geometry = new THREE.TorusGeometry(0.205 + index * 0.008, 0.0024, 8, 96);
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xffffff : 0x79f4ff,
        transparent: true,
        opacity: index === 1 ? 0.42 : 0.56,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.set(rotation[0], rotation[1], rotation[2]);
      this.geometries.push(geometry);
      this.materials.push(material);
      this.rings.push(ring);
      this.group.add(ring);
    });

    const pointPositions = [];
    const pointCount = 18;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < pointCount; i++) {
      const y = 1 - ((i + 0.5) / pointCount) * 2;
      const radial = Math.sqrt(1 - y * y);
      const angle = i * goldenAngle;
      const radius = 0.232 + (i % 3) * 0.008;
      pointPositions.push(
        Math.cos(angle) * radial * radius,
        y * radius,
        Math.sin(angle) * radial * radius
      );
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    const pointMaterial = new THREE.PointsMaterial({
      color: 0xc4fbff,
      size: 0.008,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(pointGeometry, pointMaterial);
    this.geometries.push(pointGeometry);
    this.materials.push(pointMaterial);
    this.group.add(this.points);

    this.el.setObject3D("mesh", this.group);
  },

  tick(time, delta) {
    const seconds = time / 1000;
    this.materials.forEach((material) => {
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = seconds;
      }
    });
    this.group.rotation.y += delta * 0.00012;
    this.group.position.y = Math.sin(seconds * 1.5) * 0.012;
    const pulse = 1 + Math.sin(seconds * 2.4) * 0.018;
    this.group.scale.setScalar(pulse);
    this.rings[0].rotation.z += delta * 0.00045;
    this.rings[1].rotation.x -= delta * 0.00038;
    this.rings[2].rotation.y += delta * 0.00032;
    this.points.rotation.y -= delta * 0.00022;
  },

  remove() {
    this.el.removeObject3D("mesh");
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  },
});

/* =============================================================
   gltf-orb-effect — play the model's own motion and make its
   metallic shards readable without Sketchfab's studio lighting
   ============================================================= */
/* =============================================================
   touch-launch — launch when a controller or a tracked hand
   physically reaches/touches the orb (in addition to the laser)
   ============================================================= */
AFRAME.registerComponent("touch-launch", {
  schema: { threshold: { default: 0.34 } },
  init() {
    this.hands = [];
    ["#leftHand", "#rightHand", "#leftHandTrack", "#rightHandTrack"].forEach((id) => {
      const e = this.el.sceneEl.querySelector(id);
      if (e) this.hands.push(e);
    });
    this._o = new THREE.Vector3();
    this._h = new THREE.Vector3();
    this._t = 0;
  },
  tick(time) {
    // Throttle to ~every 80ms; stop checking once launched
    if (time - this._t < 80) return;
    this._t = time;
    if (this.el.sceneEl.is("launched")) return;
    if (!this.el.object3D) return;
    this.el.object3D.getWorldPosition(this._o);
    const thr = this.data.threshold;
    for (const hand of this.hands) {
      if (!hand.object3D || !hand.object3D.visible) continue;
      hand.object3D.getWorldPosition(this._h);
      if (this._h.lengthSq() === 0) continue; // untracked input sits at origin
      if (this._o.distanceTo(this._h) < thr) {
        this.el.sceneEl.emit("launch");
        break;
      }
    }
  },
});

/* =============================================================
   launch-button — the clickable orb
   ============================================================= */
AFRAME.registerComponent("launch-button", {
  init() {
    this.el.addEventListener("mouseenter", () => {
      this.el.setAttribute("material", "emissiveIntensity", 2.6);
      SFX.hover();
    });
    this.el.addEventListener("mouseleave", () => {
      this.el.setAttribute("material", "emissiveIntensity", 1.4);
    });
    this.el.addEventListener("click", () => {
      SFX.click();
      this.el.sceneEl.emit("launch");
    });
  },
});

/* =============================================================
   launch-sequence — the opening ceremony choreography (on <a-scene>)
   ============================================================= */
AFRAME.registerComponent("launch-sequence", {
  init() {
    this.fired = false;
    this.hasVideo = true;

    const scene = this.el;
    this.orbGroup = scene.querySelector("#orbGroup");
    this.orb = scene.querySelector("#orb");
    this.screenLogo = scene.querySelector("#screenLogo");
    this.screenVideo = scene.querySelector("#screenVideo");
    this.screenPlaceholder = scene.querySelector("#screenPlaceholder");
    this.placeholderText = this.screenPlaceholder;
    this.beam = scene.querySelector("#beam");
    this.ripple = scene.querySelector("#ripple");
    this.ambient = scene.querySelector("[light*='ambient']");
    this.keyLight = scene.querySelector("#keyLight");
    this.video = document.getElementById("openingVideo");
    this.filmScreen = scene.querySelector("#filmScreen");
    this.dimmer = scene.querySelector("#dimmer");
    this.v360 = document.getElementById("v360");
    this.hint = document.getElementById("hint");

    // Detect a missing / unplayable opening film so we can show a placeholder
    if (this.video) {
      this.video.addEventListener("error", () => {
        this.hasVideo = false;
      });
      // 404 shows up as an error; give the browser a moment to attempt load
      if (this.video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        this.hasVideo = false;
      }
    } else {
      this.hasVideo = false;
    }

    // Start the 360 environment loop (muted autoplay; retried on VR enter).
    this.setup360();

    // Hide the operator note the moment we go immersive
    scene.addEventListener("enter-vr", () => {
      if (this.hint) this.hint.style.display = "none";
    });
    scene.addEventListener("exit-vr", () => {
      if (this.hint) this.hint.style.display = "";
    });

    // Trigger from the orb
    scene.addEventListener("launch", () => this.launch());

    // Operator keys: Space/L launch, Esc close film & return to idle
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        this.resetToIdle();
        return;
      }
      if (e.code === "Space" || e.key.toLowerCase() === "l") {
        e.preventDefault();
        scene.emit("launch");
      }
    });
  },

  launch() {
    if (this.fired) return;
    this.fired = true;
    this.el.addState("launched");

    SFX.launch();
    this.burstParticles();
    this.playBeam();
    this.playRipple();

    if (this.hint) this.hint.style.display = "none";

    // Fade the orb out
    if (this.orbGroup) {
      this.orbGroup.removeAttribute("animation__out");
      this.orbGroup.setAttribute("animation__out", {
        property: "scale",
        to: "0 0 0",
        dur: 700,
        easing: "easeInBack",
      });
      clearTimeout(this._orbHideTimer);
      this._orbHideTimer = setTimeout(() => this.orbGroup.setAttribute("visible", false), 750);
    }

    // Dim the surrounding 360 so the film reads cinematically
    if (this.dimmer) {
      this.dimmer.removeAttribute("animation__dim");
      this.dimmer.removeAttribute("animation__undim");
      this.dimmer.setAttribute("animation__dim", {
        property: "material.opacity",
        to: 0.78,
        dur: 900,
        easing: "easeInOutSine",
      });
    }
    if (this.ambient) tweenProp(this.ambient, "light", "intensity", 0.6, 0.12, 900);
    if (this.keyLight) tweenProp(this.keyLight, "light", "intensity", 0.9, 0.25, 900);

    // Float the film screen in, then play after the burst
    if (this.filmScreen) this.filmScreen.setAttribute("visible", true);
    clearTimeout(this._revealTimer);
    this._revealTimer = setTimeout(() => this.revealScreen(), 850);
  },

  setup360() {
    if (!this.v360) return;
    const play = () => {
      const p = this.v360.play();
      if (p && p.catch) p.catch(() => {});
    };
    // Try once the scene is ready, and again on first VR enter (gesture)
    if (this.el.hasLoaded) play();
    else this.el.addEventListener("loaded", play, { once: true });
    this.el.addEventListener("enter-vr", play);
    document.addEventListener("click", play, { once: true });
  },

  revealScreen() {
    if (this.screenLogo) this.screenLogo.setAttribute("visible", false);

    if (this.hasVideo && this.video) {
      const p = this.video.play();
      if (p && p.catch) {
        p.catch(() => {
          this.hasVideo = false;
          this.showPlaceholder();
        });
      }
      if (this.hasVideo) {
        this.screenVideo.setAttribute("visible", true);
        this._onVideoEnded = () => this.finish();
        this.video.addEventListener("ended", this._onVideoEnded, { once: true });
      } else {
        this.showPlaceholder();
      }
    } else {
      this.showPlaceholder();
    }
  },

  showPlaceholder() {
    if (this.screenPlaceholder) this.screenPlaceholder.setAttribute("visible", true);
    if (this.screenVideo) this.screenVideo.setAttribute("visible", false);
  },

  /* Esc / operator: stop film and restore standby (orb + title + bright 360) */
  resetToIdle() {
    if (!this.fired) return;

    clearTimeout(this._revealTimer);
    clearTimeout(this._orbHideTimer);

    if (this.video) {
      if (this._onVideoEnded) {
        this.video.removeEventListener("ended", this._onVideoEnded);
        this._onVideoEnded = null;
      }
      try {
        this.video.pause();
        this.video.currentTime = 0;
      } catch (e) {}
    }

    if (this.screenVideo) this.screenVideo.setAttribute("visible", false);
    if (this.screenPlaceholder) this.screenPlaceholder.setAttribute("visible", false);
    if (this.filmScreen) this.filmScreen.setAttribute("visible", false);
    if (this.screenLogo) this.screenLogo.setAttribute("visible", true);

    if (this.dimmer) {
      this.dimmer.removeAttribute("animation__dim");
      this.dimmer.removeAttribute("animation__undim");
      this.dimmer.setAttribute("material", "opacity", 0);
    }
    if (this.ambient) this.ambient.setAttribute("light", "intensity", 0.6);
    if (this.keyLight) this.keyLight.setAttribute("light", "intensity", 0.9);

    if (this.orbGroup) {
      this.orbGroup.removeAttribute("animation__out");
      this.orbGroup.setAttribute("scale", "1 1 1");
      this.orbGroup.setAttribute("visible", true);
    }

    if (this.beam) this.beam.setAttribute("visible", false);
    if (this.ripple) this.ripple.setAttribute("visible", false);

    this.fired = false;
    this.el.removeState("launched");

    if (this.hint && !this.el.is("vr-mode")) this.hint.style.display = "";

    // Keep 360 looping
    if (this.v360) {
      const p = this.v360.play();
      if (p && p.catch) p.catch(() => {});
    }
  },

  finish() {
    // Bring the world back and celebrate
    if (this.dimmer) {
      this.dimmer.setAttribute("animation__undim", {
        property: "material.opacity",
        to: 0,
        dur: 1400,
        easing: "easeInOutSine",
      });
    }
    if (this.ambient) tweenProp(this.ambient, "light", "intensity", 0.12, 0.6, 1200);
    if (this.keyLight) tweenProp(this.keyLight, "light", "intensity", 0.25, 0.9, 1200);
    this.burstParticles(60, "#f2c14e");
  },

  /* ----- Custom particle burst (no external dependency) ----- */
  burstParticles(count = 48, color = "#9fc2ff") {
    const origin = this.orbGroup || this.el;
    const originPos = origin.getAttribute("position") || { x: 0, y: 1.35, z: -2.2 };

    for (let i = 0; i < count; i++) {
      const p = document.createElement("a-sphere");
      p.setAttribute("radius", 0.03 + Math.random() * 0.03);
      p.setAttribute(
        "material",
        `color: ${color}; emissive: ${color}; emissiveIntensity: 2; opacity: 0.95; transparent: true`
      );
      p.setAttribute("position", `${originPos.x} ${originPos.y} ${originPos.z}`);

      const dx = (Math.random() - 0.5) * 6;
      const dy = Math.random() * 4;
      const dz = (Math.random() - 0.5) * 6;
      const dur = 700 + Math.random() * 700;

      p.setAttribute("animation__move", {
        property: "position",
        to: `${originPos.x + dx} ${originPos.y + dy} ${originPos.z + dz}`,
        dur,
        easing: "easeOutCubic",
      });
      p.setAttribute("animation__fade", {
        property: "material.opacity",
        to: 0,
        dur,
        easing: "easeInCubic",
      });

      this.el.appendChild(p);
      setTimeout(() => p.parentNode && p.parentNode.removeChild(p), dur + 60);
    }
  },

  /* ----- Light beam shoots up ----- */
  playBeam() {
    if (!this.beam) return;
    this.beam.setAttribute("visible", true);
    this.beam.setAttribute("height", 0.1);
    this.beam.setAttribute("position", "0 0 -0.2");
    this.beam.setAttribute("animation__grow", {
      property: "height",
      from: 0.1,
      to: 18,
      dur: 800,
      easing: "easeOutQuart",
    });
    this.beam.setAttribute("animation__rise", {
      property: "position",
      from: "0 0 -0.2",
      to: "0 9 -0.2",
      dur: 800,
      easing: "easeOutQuart",
    });
    this.beam.setAttribute("animation__fade", {
      property: "material.opacity",
      from: 0.55,
      to: 0,
      dur: 1600,
      easing: "easeInCubic",
    });
    setTimeout(() => this.beam.setAttribute("visible", false), 1700);
  },

  /* ----- Floor ripple expands outward ----- */
  playRipple() {
    if (!this.ripple) return;
    this.ripple.setAttribute("visible", true);
    this.ripple.setAttribute("material", "opacity", 0.9);
    this.ripple.setAttribute("scale", "1 1 1");
    this.ripple.setAttribute("animation__expand", {
      property: "scale",
      from: "1 1 1",
      to: "9 9 9",
      dur: 1400,
      easing: "easeOutQuad",
    });
    this.ripple.setAttribute("animation__fade", {
      property: "material.opacity",
      from: 0.9,
      to: 0,
      dur: 1400,
      easing: "easeInQuad",
    });
    setTimeout(() => this.ripple.setAttribute("visible", false), 1450);
  },
});
