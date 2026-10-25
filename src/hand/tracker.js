// Câmera + detector de mãos do MediaPipe Tasks (roda na placa de vídeo quando possível).
import { MEDIAPIPE_WASM, HAND_MODEL, HAND_MODEL_FALLBACK } from "../config.js";
import { state } from "../state.js";

let handLandmarker = null;
let video = null;
let lastVideoTime = -1;

// O vídeo da câmera (null antes de ligar). Usado pelo modo AR.
export function getVideo() {
  return video && video.videoWidth ? video : null;
}

export function isTrackingReady() {
  return handLandmarker !== null;
}

function createLandmarker(HandLandmarker, vision, modelPath, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
}

// Tenta GPU e depois CPU; com o modelo local e depois o online.
async function createBestLandmarker(HandLandmarker, vision) {
  const attempts = [
    [HAND_MODEL, "GPU"],
    [HAND_MODEL, "CPU"],
    [HAND_MODEL_FALLBACK, "GPU"],
    [HAND_MODEL_FALLBACK, "CPU"]
  ];
  let lastError;
  for (const [model, delegate] of attempts) {
    try {
      return await createLandmarker(HandLandmarker, vision, model, delegate);
    } catch (err) {
      console.warn(`Detector com ${delegate} (${model}) falhou.`, err);
      lastError = err;
    }
  }
  throw lastError;
}

// Liga a câmera e ajusta a caixa da webcam à resolução que ela entregou.
// Lança "camera" ou "detector" como erro para a interface mostrar a mensagem certa.
export async function startTracking(videoElement, webcamCanvas, onStatus) {
  video = videoElement;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (video.readyState < 2) {
      await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
    }
  } catch (err) {
    console.error(err);
    throw new Error("camera");
  }

  const { videoWidth: width, videoHeight: height } = video;
  state.cameraAspect = width / height;
  webcamCanvas.width = width;
  webcamCanvas.height = height;
  webcamCanvas.parentElement.style.aspectRatio = `${width} / ${height}`;

  onStatus("Câmera ligada. Carregando o detector de mãos...");

  try {
    // Carregado sob demanda: se falhar, as partículas continuam funcionando.
    const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    handLandmarker = await createBestLandmarker(HandLandmarker, vision);
  } catch (err) {
    console.error(err);
    throw new Error("detector");
  }
}

// Roda o detector só quando a câmera tem um quadro novo (no loop de animação, sem fila de quadros atrasados).
// Retorna null se não há quadro novo; senão { landmarks, worldLandmarks } (listas vazias sem mão).
export function detectHands() {
  if (!handLandmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return null;
  lastVideoTime = video.currentTime;
  const result = handLandmarker.detectForVideo(video, performance.now());
  return { landmarks: result.landmarks, worldLandmarks: result.worldLandmarks };
}
