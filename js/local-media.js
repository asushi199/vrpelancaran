(function () {
  const MINIMUM_FILE_BYTES = 1024 * 1024;
  const state = { isReady: false };
  window.VROfflineMedia = state;

  let prepareButton;
  let statusText;
  let space360Input;
  let openingInput;
  let objectUrls = [];

  function setStatus(message, kind) {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.dataset.kind = kind || "";
  }

  function validVideoFile(file) {
    return file && file.size >= MINIMUM_FILE_BYTES && (file.type.startsWith("video/") || /\.mp4$/i.test(file.name));
  }

  function releaseObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function waitForMetadata(video) {
    return new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", resolve, { once: true });
      video.addEventListener("error", () => reject(new Error("Fail video tidak dapat dimainkan pada headset.")), { once: true });
    });
  }

  function setVideoSource(video, file) {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    video.pause();
    video.src = url;
    const metadata = waitForMetadata(video);
    video.load();
    return metadata;
  }

  function updateButton() {
    if (!prepareButton) return;
    prepareButton.disabled = !(validVideoFile(space360Input?.files[0]) && validVideoFile(openingInput?.files[0]));
  }

  async function useLocalMedia() {
    const space360File = space360Input?.files[0];
    const openingFile = openingInput?.files[0];
    if (!validVideoFile(space360File) || !validVideoFile(openingFile)) {
      setStatus("Pilih dua fail MP4 yang betul dahulu.", "error");
      return;
    }

    const v360 = document.getElementById("v360");
    const openingVideo = document.getElementById("openingVideo");
    if (!v360 || !openingVideo) {
      setStatus("Pemain video VR tidak ditemui.", "error");
      return;
    }

    prepareButton.disabled = true;
    setStatus("Sedang membuka fail tempatan pada headset…", "");
    releaseObjectUrls();
    try {
      await Promise.all([setVideoSource(v360, space360File), setVideoSource(openingVideo, openingFile)]);
      state.isReady = true;
      prepareButton.textContent = "FAIL TEMPATAN SEDIA";
      setStatus("Dua-dua fail tempatan sedia. VR boleh dimulakan tanpa Internet.", "ready");
      window.dispatchEvent(new Event("offline-media-ready"));
    } catch (error) {
      state.isReady = false;
      updateButton();
      setStatus(error.message || "Fail video tidak dapat dibuka.", "error");
    }
  }

  window.addEventListener("offline-media-not-ready", () => {
    document.getElementById("offlineMediaPanel")?.removeAttribute("hidden");
    setStatus("Pilih kedua-dua fail tempatan sebelum majlis dimulakan.", "error");
  });

  document.addEventListener("DOMContentLoaded", () => {
    prepareButton = document.getElementById("prepareOfflineButton");
    statusText = document.getElementById("offlineMediaStatus");
    space360Input = document.getElementById("space360File");
    openingInput = document.getElementById("openingFile");
    space360Input?.addEventListener("change", updateButton);
    openingInput?.addEventListener("change", updateButton);
    prepareButton?.addEventListener("click", useLocalMedia);
  });
})();
