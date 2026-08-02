/* =============================================================
   Pelancaran VR — launch interaction & opening ceremony effects
   Program Sokongan Profesional: Dasar Pendidikan Digital
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
      this.orbGroup.object3D.scale.set(1, 1, 1);
    }
  },
  setHoldProgress(progress) {
    if (!this.orbGroup) return;
    const eased = 1 - Math.pow(1 - progress, 2);
    const scale = 1 + eased * 0.13;
    this.orbGroup.object3D.scale.set(scale, scale, scale);
  },
  isInside(position) {
    if (!this.el.object3D) return false;
    this.el.object3D.getWorldPosition(this._o);
    this._h.copy(position);
    return this._o.distanceTo(this._h) < this.data.threshold;
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
      this.el.setAttribute("material", "emissiveIntensity", 2.6);
      SFX.hover();
    });
    this.el.addEventListener("mouseleave", () => {
      this.el.setAttribute("material", "emissiveIntensity", 1.4);
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
      if (paletteRoll > 0.91) color.set("#f2c76e");
      else if (paletteRoll > 0.56) color.set("#dffaff");
      else color.set("#4edcff");
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
    this.launchParticles = scene.querySelector("#launchParticles");
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
    this.simulatorHint = document.getElementById("simulatorHint");
    if (this.simulatorHint && SIMULATE_VR) this.simulatorHint.hidden = false;

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

    window.addEventListener("offline-media-ready", () => {
      this.hasVideo = Boolean(this.video?.src);
    });

    // Start the 360 environment loop (muted autoplay; retried on VR enter).
    this.setup360();

    // Hide the operator note the moment we go immersive
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

    // Operator keys: Space/L launch, Esc close film & return to idle
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

  launch() {
    if (this.fired) return;
    if (!window.VROfflineMedia || !window.VROfflineMedia.isReady) {
      this.el.emit("offline-media-not-ready");
      return;
    }
    this.fired = true;
    this.el.addState("launched");
    this.el.removeState("standby-ready");

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

    // The screen emerges while the last particles are fading into the background.
    clearTimeout(this._revealTimer);
    this._revealTimer = setTimeout(() => this.revealScreen(), 980);
  },

  setup360() {
    if (!this.v360) return;
    const play = () => {
      if (!window.VROfflineMedia || !window.VROfflineMedia.isReady) return;
      const p = this.v360.play();
      if (p && p.catch) p.catch(() => {});
    };
    // Try once the scene is ready, and again on first VR enter (gesture)
    if (this.el.hasLoaded) play();
    else this.el.addEventListener("loaded", play, { once: true });
    this.el.addEventListener("enter-vr", play);
    document.addEventListener("click", play, { once: true });
    window.addEventListener("offline-media-ready", play, { once: true });
  },

  revealScreen() {
    if (this.screenLogo) this.screenLogo.setAttribute("visible", false);
    if (this.filmScreen) {
      this.filmScreen.setAttribute("visible", true);
      this.filmScreen.setAttribute("position", "0 0 -0.38");
      this.filmScreen.setAttribute("scale", "0.96 0.96 0.96");
      this.filmScreen.removeAttribute("animation__reveal");
      this.filmScreen.removeAttribute("animation__approach");
      this.filmScreen.setAttribute("animation__reveal", {
        property: "scale",
        from: "0.96 0.96 0.96",
        to: "1 1 1",
        dur: 920,
        easing: "easeOutCubic",
      });
      this.filmScreen.setAttribute("animation__approach", {
        property: "position",
        from: "0 0 -0.38",
        to: "0 0 0",
        dur: 920,
        easing: "easeOutCubic",
      });
    }

    if (this.hasVideo && this.video) {
      // Quest Browser is more stable when it only decodes one video texture at a time.
      if (this.v360) {
        try {
          this.v360.pause();
        } catch (e) {}
      }
      const p = this.video.play();
      if (p && p.catch) {
        p.catch(() => {
          this.hasVideo = false;
          this.showPlaceholder();
          if (this.v360) {
            const backgroundPlay = this.v360.play();
            if (backgroundPlay && backgroundPlay.catch) backgroundPlay.catch(() => {});
          }
        });
      }
      if (this.hasVideo) {
        this.screenVideo.setAttribute("visible", true);
        this.screenVideo.setAttribute("curved-video", "opacity", 0);
        this.screenVideo.removeAttribute("animation__fadein");
        this.screenVideo.setAttribute("animation__fadein", {
          property: "curved-video.opacity",
          from: 0,
          to: 1,
          dur: 880,
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
    if (this.filmScreen) {
      this.filmScreen.removeAttribute("animation__reveal");
      this.filmScreen.removeAttribute("animation__approach");
      this.filmScreen.setAttribute("position", "0 0 0");
      this.filmScreen.setAttribute("scale", "1 1 1");
      this.filmScreen.setAttribute("visible", false);
    }
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
    const dissolve = this.launchParticles && this.launchParticles.components["orb-dissolve"];
    if (dissolve) dissolve.reset();

    this.fired = false;
    this.el.removeState("launched");
    this.el.emit("recenter-standby");

    if (this.hint && !this.el.is("vr-mode")) this.hint.style.display = "";

    // Keep 360 looping
    if (this.v360) {
      const p = this.v360.play();
      if (p && p.catch) p.catch(() => {});
    }
  },

  finish() {
    // Bring the world back and celebrate
    if (this.v360) {
      const p = this.v360.play();
      if (p && p.catch) p.catch(() => {});
    }
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

  /* ----- Orb condenses, dissolves into light, then reveals the film ----- */
  playOrbTransition() {
    if (!this.orbGroup) return;

    this.orbGroup.setAttribute("visible", true);
    this.orbGroup.setAttribute("scale", "1 1 1");
    this.orbGroup.removeAttribute("animation__charge");
    this.orbGroup.removeAttribute("animation__out");
    this.orbGroup.setAttribute("animation__charge", {
      property: "scale",
      from: "1 1 1",
      to: "0.82 0.82 0.82",
      dur: 180,
      easing: "easeInCubic",
    });

    clearTimeout(this._orbCollapseTimer);
    this._orbCollapseTimer = setTimeout(() => {
      this.orbGroup.removeAttribute("animation__charge");
      this.orbGroup.setAttribute("animation__out", {
        property: "scale",
        from: "0.82 0.82 0.82",
        to: "0.01 0.01 0.01",
        dur: 360,
        easing: "easeInCubic",
      });

      if (this.orbEcho) {
        this.orbEcho.setAttribute("visible", true);
        this.orbEcho.setAttribute("scale", "0.72 0.72 0.72");
        this.orbEcho.setAttribute("material", "opacity", 0.52);
        this.orbEcho.removeAttribute("animation__expand");
        this.orbEcho.removeAttribute("animation__fade");
        this.orbEcho.setAttribute("animation__expand", {
          property: "scale",
          from: "0.72 0.72 0.72",
          to: "2.75 2.75 2.75",
          dur: 620,
          easing: "easeOutQuart",
        });
        this.orbEcho.setAttribute("animation__fade", {
          property: "material.opacity",
          from: 0.52,
          to: 0,
          dur: 620,
          easing: "easeInCubic",
        });
      }

      const dissolve = this.launchParticles && this.launchParticles.components["orb-dissolve"];
      if (dissolve) {
        const origin = new THREE.Vector3();
        this.orbGroup.object3D.getWorldPosition(origin);
        dissolve.start(origin);
      }
    }, 180);

    clearTimeout(this._orbHideTimer);
    this._orbHideTimer = setTimeout(() => this.orbGroup.setAttribute("visible", false), 540);
    clearTimeout(this._echoHideTimer);
    this._echoHideTimer = setTimeout(() => {
      if (this.orbEcho) this.orbEcho.setAttribute("visible", false);
    }, 820);
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
