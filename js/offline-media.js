(function () {
  const MEDIA_COUNT = 2;
  const state = { isReady: false };
  window.VROfflineMedia = state;

  let prepareButton;
  let statusText;
  let progressBar;

  function setStatus(message, kind) {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.dataset.kind = kind || "";
  }

  function formatMegabytes(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setProgress(loadedBytes, totalBytes, completed) {
    if (!totalBytes) {
      if (progressBar) progressBar.value = 0;
      setStatus("Menyediakan muat turun filem…", "");
      return;
    }

    const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
    if (progressBar) progressBar.value = percent;
    setStatus(
      `Sedang memuat turun ${percent}% (${formatMegabytes(loadedBytes)} / ${formatMegabytes(totalBytes)}). Filem ${Math.min(completed + 1, MEDIA_COUNT)}/${MEDIA_COUNT}.`,
      ""
    );
  }

  function setReady() {
    state.isReady = true;
    if (prepareButton) {
      prepareButton.disabled = true;
      prepareButton.textContent = "FILEM SEDIA";
    }
    if (progressBar) progressBar.value = 100;
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
    setProgress(0, 0, 0);
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
      setProgress(message.loadedBytes, message.totalBytes, message.completed);
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
    progressBar = document.getElementById("offlineMediaProgress");
    prepareButton?.addEventListener("click", requestPreparation);
    requestStatus();
  });
})();
