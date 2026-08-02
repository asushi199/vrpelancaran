(function () {
  const MEDIA_COUNT = 2;
  const state = { isReady: false };
  window.VROfflineMedia = state;

  let prepareButton;
  let statusText;

  function setStatus(message, kind) {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.dataset.kind = kind || "";
  }

  function setReady() {
    state.isReady = true;
    if (prepareButton) {
      prepareButton.disabled = true;
      prepareButton.textContent = "FILEM SEDIA";
    }
    setStatus("Dua-dua filem telah dimuat turun. VR sedia dimulakan.", "ready");
    window.dispatchEvent(new Event("offline-media-ready"));
  }

  async function activeWorker() {
    if (!("serviceWorker" in navigator)) throw new Error("Pelayar ini tidak menyokong mod luar talian.");
    const registration = await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) throw new Error("Penyedia luar talian belum bersedia. Muat semula halaman sekali.");
    return worker;
  }

  async function requestPreparation() {
    if (prepareButton) prepareButton.disabled = true;
    setStatus("Sedang memuat turun filem 0/2. Kekalkan headset dan halaman ini terbuka.");
    try {
      const worker = await activeWorker();
      worker.postMessage({ type: "offline-media-prepare" });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (error) {
      if (prepareButton) prepareButton.disabled = false;
      setStatus(error.message || "Persediaan luar talian gagal.", "error");
    }
  }

  async function requestStatus() {
    try {
      const worker = await activeWorker();
      worker.postMessage({ type: "offline-media-status" });
    } catch (error) {
      setStatus("Tekan MUAT TURUN FILEM semasa sambungan Internet tersedia.");
    }
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    const message = event.data || {};
    if (message.type === "offline-media-progress") {
      setStatus(`Sedang memuat turun filem ${message.completed}/${MEDIA_COUNT}. Kekalkan halaman ini terbuka.`);
    }
    if (message.type === "offline-media-status" && message.ready) setReady();
    if (message.type === "offline-media-complete") setReady();
    if (message.type === "offline-media-error") {
      if (prepareButton) prepareButton.disabled = false;
      setStatus(message.message || "Persediaan luar talian gagal.", "error");
    }
  });

  window.addEventListener("offline-media-not-ready", () => {
    document.getElementById("offlineMediaPanel")?.removeAttribute("hidden");
    setStatus("Sila lengkapkan muat turun filem sebelum majlis dimulakan.", "error");
  });

  document.addEventListener("DOMContentLoaded", () => {
    prepareButton = document.getElementById("prepareOfflineButton");
    statusText = document.getElementById("offlineMediaStatus");
    prepareButton?.addEventListener("click", requestPreparation);
    requestStatus();
  });
})();
