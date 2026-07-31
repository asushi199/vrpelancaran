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
   standby-anchor - follow the current wearer until launch, then
   keep the ceremony fixed in the room for comfortable viewing
   ============================================================= */
AFRAME.registerComponent("standby-anchor", {
  init() {
    this.camera = null;
    this.cameraPosition = new THREE.Vector3();
    this.cameraQuaternion = new THREE.Quaternion();
    this.anchorQuaternion = new THREE.Quaternion();
    this.cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
    this.up = new THREE.Vector3(0, 1, 0);
  },
  tick() {
    const scene = this.el.sceneEl;
    if (!scene || scene.is("launched")) return;

    if (!this.camera) this.camera = scene.camera && scene.camera.el;
    if (!this.camera || !this.camera.object3D) return;

    this.camera.object3D.getWorldPosition(this.cameraPosition);
    this.camera.object3D.getWorldQuaternion(this.cameraQuaternion);
    this.cameraRotation.setFromQuaternion(this.cameraQuaternion, "YXZ");
    this.anchorQuaternion.setFromAxisAngle(this.up, this.cameraRotation.y);

    this.el.object3D.position.copy(this.cameraPosition);
    this.el.object3D.quaternion.copy(this.anchorQuaternion);
  },
});

/* =============================================================
   touch-launch — launch when a controller or a tracked hand
   physically reaches/touches the orb (in addition to the laser)
   ============================================================= */
AFRAME.registerComponent("touch-launch", {
  schema: { threshold: { default: 0.34 } },
  init() {
    this.controllers = [];
    this.trackedHands = [];
    this.pinchHandlers = new Map();
    this._o = new THREE.Vector3();
    this._h = new THREE.Vector3();
    this._t = 0;

    this.resolveInputs = this.resolveInputs.bind(this);
    this.onEnterVR = () => this.resolveInputs();
    this.el.sceneEl.addEventListener("loaded", this.resolveInputs, { once: true });
    this.el.sceneEl.addEventListener("enter-vr", this.onEnterVR);
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

    for (const hand of this.trackedHands) {
      if (this.pinchHandlers.has(hand)) continue;
      const handler = (event) => {
        const position = event.detail && event.detail.position;
        if (position) this.tryLaunchAt(position);
      };
      hand.addEventListener("pinchstarted", handler);
      this.pinchHandlers.set(hand, handler);
    }
  },
  tryLaunchAt(position) {
    if (this.el.sceneEl.is("launched") || !this.el.object3D) return false;
    this.el.object3D.getWorldPosition(this._o);
    this._h.copy(position);
    if (this._o.distanceTo(this._h) >= this.data.threshold) return false;
    this.el.sceneEl.emit("launch");
    return true;
  },
  tick(time) {
    // Throttle to ~every 80ms; stop checking once launched
    if (time - this._t < 80) return;
    this._t = time;
    if (this.el.sceneEl.is("launched")) return;

    if (!this.controllers.length && !this.trackedHands.length) this.resolveInputs();

    // Bare-hand tracking: test the real index fingertip, not the hand entity origin.
    for (const hand of this.trackedHands) {
      const tracking = hand.components["hand-tracking-controls"];
      if (!tracking || !tracking.hasPoses || !tracking.indexTipPosition) continue;
      if (this.tryLaunchAt(tracking.indexTipPosition)) return;
    }

    // Physical controller proximity remains available as a fallback.
    for (const controller of this.controllers) {
      if (!controller.object3D || !controller.object3D.visible) continue;
      controller.object3D.getWorldPosition(this._h);
      if (this._h.lengthSq() === 0) continue;
      if (this.tryLaunchAt(this._h)) return;
    }
  },
  remove() {
    this.el.sceneEl.removeEventListener("loaded", this.resolveInputs);
    this.el.sceneEl.removeEventListener("enter-vr", this.onEnterVR);
    for (const [hand, handler] of this.pinchHandlers) {
      hand.removeEventListener("pinchstarted", handler);
    }
    this.pinchHandlers.clear();
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
    this.orbEcho = scene.querySelector("#orbEcho");
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
    this.playOrbTransition();

    if (this.hint) this.hint.style.display = "none";

    // Dim the surrounding 360 so the film reads cinematically
    if (this.dimmer) {
      this.dimmer.removeAttribute("animation__dim");
      this.dimmer.removeAttribute("animation__undim");
      this.dimmer.setAttribute("animation__dim", {
        property: "material.opacity",
        to: 0.78,
        delay: 420,
        dur: 780,
        easing: "easeInOutSine",
      });
    }
    if (this.ambient) tweenProp(this.ambient, "light", "intensity", 0.6, 0.12, 1200);
    if (this.keyLight) tweenProp(this.keyLight, "light", "intensity", 0.9, 0.25, 1200);

    // The screen appears only after the orb has completed its launch gesture.
    clearTimeout(this._revealTimer);
    this._revealTimer = setTimeout(() => this.revealScreen(), 1120);
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
    if (this.filmScreen) {
      this.filmScreen.setAttribute("visible", true);
      this.filmScreen.setAttribute("scale", "0.94 0.94 0.94");
      this.filmScreen.removeAttribute("animation__reveal");
      this.filmScreen.setAttribute("animation__reveal", {
        property: "scale",
        from: "0.94 0.94 0.94",
        to: "1 1 1",
        dur: 760,
        easing: "easeOutCubic",
      });
    }

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
        this.screenVideo.setAttribute("material", "transparent", true);
        this.screenVideo.setAttribute("material", "opacity", 0);
        this.screenVideo.removeAttribute("animation__fadein");
        this.screenVideo.setAttribute("animation__fadein", {
          property: "material.opacity",
          from: 0,
          to: 1,
          dur: 720,
          easing: "easeOutCubic",
        });
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
    clearTimeout(this._orbCollapseTimer);
    clearTimeout(this._echoHideTimer);

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
      this.orbGroup.removeAttribute("animation__charge");
      this.orbGroup.removeAttribute("animation__out");
      this.orbGroup.setAttribute("scale", "1 1 1");
      this.orbGroup.setAttribute("visible", true);
    }
    if (this.orbEcho) {
      this.orbEcho.removeAttribute("animation__expand");
      this.orbEcho.removeAttribute("animation__fade");
      this.orbEcho.setAttribute("visible", false);
      this.orbEcho.setAttribute("scale", "1 1 1");
      this.orbEcho.setAttribute("material", "opacity", 0);
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

  /* ----- Orb charge, energy release, then disappearance ----- */
  playOrbTransition() {
    if (!this.orbGroup) return;

    this.orbGroup.setAttribute("visible", true);
    this.orbGroup.setAttribute("scale", "1 1 1");
    this.orbGroup.removeAttribute("animation__charge");
    this.orbGroup.removeAttribute("animation__out");
    this.orbGroup.setAttribute("animation__charge", {
      property: "scale",
      from: "1 1 1",
      to: "1.24 1.24 1.24",
      dur: 380,
      easing: "easeOutCubic",
    });

    clearTimeout(this._orbCollapseTimer);
    this._orbCollapseTimer = setTimeout(() => {
      this.orbGroup.removeAttribute("animation__charge");
      this.orbGroup.setAttribute("animation__out", {
        property: "scale",
        from: "1.24 1.24 1.24",
        to: "0.01 0.01 0.01",
        dur: 520,
        easing: "easeInBack",
      });

      if (this.orbEcho) {
        this.orbEcho.setAttribute("visible", true);
        this.orbEcho.setAttribute("scale", "0.9 0.9 0.9");
        this.orbEcho.setAttribute("material", "opacity", 0.7);
        this.orbEcho.removeAttribute("animation__expand");
        this.orbEcho.removeAttribute("animation__fade");
        this.orbEcho.setAttribute("animation__expand", {
          property: "scale",
          from: "0.9 0.9 0.9",
          to: "3.4 3.4 3.4",
          dur: 690,
          easing: "easeOutQuart",
        });
        this.orbEcho.setAttribute("animation__fade", {
          property: "material.opacity",
          from: 0.7,
          to: 0,
          dur: 690,
          easing: "easeInCubic",
        });
      }

      this.burstParticles(34, "#9feaff");
      this.playBeam();
      this.playRipple();
    }, 380);

    clearTimeout(this._orbHideTimer);
    this._orbHideTimer = setTimeout(() => this.orbGroup.setAttribute("visible", false), 940);
    clearTimeout(this._echoHideTimer);
    this._echoHideTimer = setTimeout(() => {
      if (this.orbEcho) this.orbEcho.setAttribute("visible", false);
    }, 1100);
  },

  /* ----- Custom particle burst (no external dependency) ----- */
  burstParticles(count = 48, color = "#9fc2ff") {
    const origin = this.orbGroup || this.el;
    const originPos = new THREE.Vector3(0, 1.35, -2.2);
    if (origin.object3D) origin.object3D.getWorldPosition(originPos);

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
    const origin = new THREE.Vector3(0, 1.3, -0.75);
    if (this.orbGroup && this.orbGroup.object3D) {
      this.orbGroup.object3D.getWorldPosition(origin);
    }
    this.beam.setAttribute("visible", true);
    this.beam.setAttribute("height", 0.1);
    this.beam.setAttribute("position", `${origin.x} ${origin.y} ${origin.z}`);
    this.beam.setAttribute("animation__grow", {
      property: "height",
      from: 0.1,
      to: 18,
      dur: 800,
      easing: "easeOutQuart",
    });
    this.beam.setAttribute("animation__rise", {
      property: "position",
      from: `${origin.x} ${origin.y} ${origin.z}`,
      to: `${origin.x} ${origin.y + 9} ${origin.z}`,
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
