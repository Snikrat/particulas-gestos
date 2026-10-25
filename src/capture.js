// Foto (PNG) e gravação de vídeo (WebM) da tela de partículas.
import { MAX_RECORDING_SECONDS } from "./config.js";
import { state } from "./state.js";
import { getCanvas, requestSnapshot } from "./scene/particles.js";

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function download(blob, extension) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `particulas_${timestamp()}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function takePhoto() {
  requestSnapshot((blob) => { if (blob) download(blob, "png"); });
}

let recorder = null;
let chunks = [];
let stopTimer = null;

// onChange(gravando) é chamado ao começar e ao terminar (inclusive quando para sozinho).
export function toggleRecording(onChange) {
  if (recorder) {
    recorder.stop();
    return;
  }
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m));
  const stream = getCanvas().captureStream(60);
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    clearTimeout(stopTimer);
    stream.getTracks().forEach((t) => t.stop());
    download(new Blob(chunks, { type: "video/webm" }), "webm");
    recorder = null;
    state.recording = false;
    onChange(false);
  };
  recorder.start(1000);
  state.recording = true;
  onChange(true);
  stopTimer = setTimeout(() => recorder && recorder.stop(), MAX_RECORDING_SECONDS * 1000);
}
