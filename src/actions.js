// Ações do usuário, usadas tanto pelos gestos quanto pelo painel e pelo teclado.
// Cada uma atualiza o estado, a cena, a interface e salva a configuração.
import * as THREE from "three";
import { SHAPES, IMAGE_MAX_SIZE, IMAGE_KEY, ZOOM_LEVELS, DEFAULT_ZOOM_LEVEL } from "./config.js";
import { settings, saveSettings } from "./settings.js";
import { state, clock } from "./state.js";
import { morphTo, faceFront, setHueUniform, setARMode as setSceneARMode, triggerExplosion as explode } from "./scene/particles.js";
import { setImagePixels, hasImage } from "./scene/shapes.js";
import { clearPaint, liftPen } from "./scene/trail.js";
import { clearScreenSkeleton } from "./hand/skeleton.js";
import { startCalibration as beginCalibration } from "./hand/calibration.js";
import { getVideo } from "./hand/tracker.js";
import { startMusic, stopMusic } from "./audio/music.js";
import { playExplosion, playMorph, playClick } from "./audio/sfx.js";
import { takePhoto as capturePhoto, toggleRecording as captureToggleRecording } from "./capture.js";
import { showHint } from "./ui/feedback.js";

function setToggleButton(id, on) {
  document.getElementById(id).classList.toggle("on", on);
}

export function changeShape(name) {
  if (!SHAPES.includes(name)) return;
  // Sem imagem enviada ainda: abre o seletor de arquivo em vez de trocar.
  if (name === "image" && !hasImage()) {
    document.getElementById("model-select").value = state.currentModel;
    pickImage();
    return;
  }
  state.currentModel = name;
  settings.shape = name;
  saveSettings();
  document.getElementById("model-select").value = name;
  document.getElementById("text-group").style.display = name === "text" ? "block" : "none";
  // Texto fica de frente e centralizado para ser lido.
  if (name === "text") faceFront();
  morphTo(name, settings.text);
  playMorph();
}

export function setText(text) {
  settings.text = text;
  saveSettings();
}

export function setBaseHue(hue, updatePicker) {
  state.baseHue = ((hue % 1) + 1) % 1;
  setHueUniform(state.baseHue);
  const hex = "#" + new THREE.Color().setHSL(state.baseHue, 1, 0.5).getHexString();
  state.accentHex = hex;
  settings.color = hex;
  saveSettings();
  document.documentElement.style.setProperty("--accent-color", hex);
  document.getElementById("color-hex").textContent = hex;
  if (updatePicker) document.getElementById("particle-color").value = hex;
}

export function hueFromHex(hex) {
  const hsl = {};
  new THREE.Color(hex).getHSL(hsl);
  return hsl.h;
}

// Retorna false se ainda está no intervalo mínimo entre explosões.
export function triggerExplosion() {
  const exploded = explode();
  if (exploded) playExplosion();
  return exploded;
}

export function resetZoom() {
  state.zoomLevel = DEFAULT_ZOOM_LEVEL;
  state.targetGestureScale = ZOOM_LEVELS[DEFAULT_ZOOM_LEVEL].scale;
  state.targetRotationZ = 0;
}

export function startCalibration() {
  beginCalibration(clock.elapsedTime);
}

export function toggleScreenSkeleton() {
  settings.showSkeleton = !settings.showSkeleton;
  saveSettings();
  if (!settings.showSkeleton) clearScreenSkeleton();
  showHint(settings.showSkeleton ? "Pontos da mão na tela: ligados" : "Pontos da mão na tela: desligados (continuam na webcam)");
}

export function setCameraExpanded(expanded) {
  settings.cameraExpanded = expanded;
  saveSettings();
  document.getElementById("webcam-box").classList.toggle("expanded", expanded);
}

export function toggleUI() {
  const hidden = document.body.classList.toggle("ui-hidden");
  if (hidden) showHint("Pressione H para mostrar a interface");
}

export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// ---------- Modos ----------

export function togglePaint() {
  state.paintMode = !state.paintMode;
  if (!state.paintMode) liftPen();
  setToggleButton("btn-paint", state.paintMode);
  showHint(state.paintMode
    ? "Modo pintar: aponte com o indicador para desenhar (L limpa)"
    : "Modo pintar desligado");
}

export function clearPainting() {
  clearPaint();
  showHint("Desenho apagado");
}

export async function toggleMusic() {
  if (state.musicMode) {
    stopMusic();
    setToggleButton("btn-music", false);
    showHint("Modo música desligado");
    return;
  }
  try {
    await startMusic();
    setToggleButton("btn-music", true);
    showHint("Modo música: toque uma música perto do microfone");
  } catch (err) {
    console.error(err);
    showHint("Não consegui acessar o microfone. Permita o microfone no navegador.");
  }
}

// quiet: não mostra aviso se a câmera ainda não ligou (usado ao restaurar a configuração salva).
export function setARMode(on, quiet = false) {
  if (!setSceneARMode(on, getVideo())) {
    if (!quiet) showHint("O modo AR precisa da câmera ligada");
    return;
  }
  settings.arMode = on;
  saveSettings();
  setToggleButton("btn-ar", on);
}

export function toggleAR() {
  setARMode(!settings.arMode);
}

// ---------- Imagem ----------

export function pickImage() {
  document.getElementById("image-input").click();
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Reduz a imagem e entrega os pixels para a forma "image". Retorna o canvas reduzido.
function usePixelsFrom(img) {
  const scale = Math.min(1, IMAGE_MAX_SIZE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  setImagePixels(ctx.getImageData(0, 0, canvas.width, canvas.height));
  return canvas;
}

export async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const canvas = usePixelsFrom(await loadImageElement(url));
    // Guarda a versão reduzida para a imagem voltar quando o app reabrir.
    try { localStorage.setItem(IMAGE_KEY, canvas.toDataURL("image/png")); } catch (e) {}
    changeShape("image");
  } catch (err) {
    console.error(err);
    showHint("Não consegui abrir essa imagem");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadSavedImage() {
  let saved = null;
  try { saved = localStorage.getItem(IMAGE_KEY); } catch (e) {}
  if (!saved) {
    // A forma salva era "imagem", mas a imagem não está mais guardada: volta para a árvore.
    if (state.currentModel === "image") {
      state.currentModel = "tree";
      settings.shape = "tree";
      saveSettings();
      document.getElementById("model-select").value = "tree";
    }
    return;
  }
  try {
    usePixelsFrom(await loadImageElement(saved));
    if (state.currentModel === "image") morphTo("image", settings.text);
  } catch (e) {}
}

// ---------- Foto e vídeo ----------

export function takePhoto() {
  capturePhoto();
  playClick();
  showHint("Foto salva na pasta de downloads");
}

export function toggleRecording() {
  captureToggleRecording((recording) => {
    setToggleButton("btn-record", recording);
    document.getElementById("rec-indicator").classList.toggle("visible", recording);
    showHint(recording ? "Gravando... (G para parar)" : "Vídeo salvo na pasta de downloads");
  });
}
