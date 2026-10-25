// Painel de controle, botões, sliders de ajustes e atalhos de teclado.
import { SHAPES } from "../config.js";
import { settings, saveSettings, DEFAULT_SETTINGS, SLIDER_KEYS } from "../settings.js";
import { state } from "../state.js";
import { applySmoothness } from "../hand/filters.js";
import { applySetting as applyQualitySetting } from "../scene/quality.js";
import {
  changeShape, setText, setBaseHue, hueFromHex, triggerExplosion, resetZoom, startCalibration,
  toggleScreenSkeleton, setCameraExpanded, toggleUI, toggleFullscreen,
  togglePaint, clearPainting, toggleMusic, toggleAR, pickImage, loadImageFile, takePhoto, toggleRecording
} from "../actions.js";
import { showHint } from "./feedback.js";
import { startTutorial, setupTutorial } from "./tutorial.js";

// O brilho é aplicado a cada quadro em particles.js (junto com a qualidade e a música).
const SLIDERS = [
  { id: "set-rotation", key: "rotationSensitivity", format: (v) => `${v.toFixed(1)}x` },
  { id: "set-smooth", key: "smoothness", format: (v) => `${Math.round(v * 100)}%`, apply: () => applySmoothness(settings.smoothness) },
  { id: "set-zoom", key: "zoomSensitivity", format: (v) => `${v.toFixed(1)}x` },
  { id: "set-bloom", key: "bloom", format: (v) => `${Math.round(v * 100)}%` }
];

function refreshSliders() {
  for (const s of SLIDERS) {
    document.getElementById(s.id).value = settings[s.key];
    document.getElementById(`${s.id}-value`).textContent = s.format(settings[s.key]);
    if (s.apply) s.apply();
  }
}

function setupSettings() {
  for (const s of SLIDERS) {
    document.getElementById(s.id).addEventListener("input", (e) => {
      settings[s.key] = parseFloat(e.target.value);
      document.getElementById(`${s.id}-value`).textContent = s.format(settings[s.key]);
      if (s.apply) s.apply();
      saveSettings();
    });
  }

  const quality = document.getElementById("set-quality");
  quality.value = settings.quality;
  quality.addEventListener("change", () => {
    settings.quality = quality.value;
    saveSettings();
    applyQualitySetting();
  });

  const sfx = document.getElementById("set-sfx");
  sfx.checked = settings.sfx;
  sfx.addEventListener("change", () => {
    settings.sfx = sfx.checked;
    saveSettings();
  });

  document.getElementById("btn-reset-settings").addEventListener("click", () => {
    for (const key of SLIDER_KEYS) settings[key] = DEFAULT_SETTINGS[key];
    refreshSliders();
    saveSettings();
    showHint("Ajustes restaurados");
  });
}

// Mostra o nível de qualidade em uso ao lado do seletor.
export function showQualityLevel(name) {
  document.getElementById("set-quality-value").textContent = settings.quality === "auto" ? `agora: ${name}` : "";
}

function setupKeyboard() {
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key >= "1" && key <= "8") changeShape(SHAPES[Number(key) - 1]);
    else if (key === "e") triggerExplosion();
    else if (key === "r") resetZoom();
    else if (key === "c") startCalibration();
    else if (key === "p") toggleScreenSkeleton();
    else if (key === "v") setCameraExpanded(!settings.cameraExpanded);
    else if (key === "h") toggleUI();
    else if (key === "f") toggleFullscreen();
    else if (key === "t") togglePaint();
    else if (key === "l") clearPainting();
    else if (key === "m") toggleMusic();
    else if (key === "a") toggleAR();
    else if (key === "i") pickImage();
    else if (key === "o") takePhoto();
    else if (key === "g") toggleRecording();
  });
}

export function setupPanel() {
  const modelSelect = document.getElementById("model-select");
  const colorInput = document.getElementById("particle-color");
  const textInput = document.getElementById("text-input");
  const imageInput = document.getElementById("image-input");

  modelSelect.addEventListener("change", (e) => changeShape(e.target.value));
  colorInput.addEventListener("input", (e) => setBaseHue(hueFromHex(e.target.value), false));

  let textTimer = null;
  textInput.addEventListener("input", () => {
    setText(textInput.value);
    clearTimeout(textTimer);
    textTimer = setTimeout(() => { if (state.currentModel === "text") changeShape("text"); }, 400);
  });

  imageInput.addEventListener("change", () => {
    if (imageInput.files[0]) loadImageFile(imageInput.files[0]);
    // Limpa para poder escolher o mesmo arquivo de novo.
    imageInput.value = "";
  });

  const clicks = {
    "btn-reset-zoom": resetZoom,
    "btn-explode": triggerExplosion,
    "btn-calibrate": startCalibration,
    "btn-skeleton": toggleScreenSkeleton,
    "btn-camera": () => setCameraExpanded(!settings.cameraExpanded),
    "webcam-box": () => setCameraExpanded(!settings.cameraExpanded),
    "btn-hide-ui": toggleUI,
    "btn-fullscreen": toggleFullscreen,
    "btn-paint": togglePaint,
    "btn-music": toggleMusic,
    "btn-ar": toggleAR,
    "btn-image": pickImage,
    "btn-photo": takePhoto,
    "btn-record": toggleRecording,
    "btn-tutorial": startTutorial
  };
  for (const [id, handler] of Object.entries(clicks)) {
    document.getElementById(id).addEventListener("click", handler);
  }

  setupSettings();
  setupKeyboard();
  setupTutorial();

  // Restaura o que foi salvo da última vez.
  colorInput.value = settings.color;
  setBaseHue(hueFromHex(settings.color), false);
  modelSelect.value = state.currentModel;
  document.getElementById("text-group").style.display = state.currentModel === "text" ? "block" : "none";
  document.getElementById("webcam-box").classList.toggle("expanded", settings.cameraExpanded);
  refreshSliders();
}
