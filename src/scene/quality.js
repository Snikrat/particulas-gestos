// Qualidade automática: mede o FPS e troca o nível (nº de partículas, resolução, brilho) para manter a fluidez.
import { QUALITY_LEVELS, QUALITY_DOWN_FPS, QUALITY_UP_FPS, WEBGL_FALLBACK_QUALITY } from "../config.js";
import { settings } from "../settings.js";
import { applyQualityLevel, isWebGPU } from "./particles.js";

const WINDOW_SECONDS = 2;     // janela de medição do FPS
const UP_AFTER_SECONDS = 8;   // tempo com folga antes de subir de nível
const COOLDOWN_SECONDS = 4;   // espera depois de cada troca (o FPS demora a estabilizar)
const WARMUP_SECONDS = 3;     // ignora o começo (carregamento, compilação de shaders)

let level = 0;
let frames = 0;
let elapsed = 0;
let goodTime = 0;
let cooldown = WARMUP_SECONDS;
let onChange = () => {};

export function currentQualityName() {
  return QUALITY_LEVELS[level].name;
}

function setLevel(index) {
  level = index;
  applyQualityLevel(level);
  onChange(QUALITY_LEVELS[level].name);
}

// listener recebe o nome do nível atual sempre que ele muda.
export function initQuality(listener) {
  onChange = listener;
  applySetting();
}

// Aplica o que está em settings.quality. O automático começa no mais alto com WebGPU
// e num nível mais leve no plano B em WebGL (bem mais lento para essa quantidade de partículas).
export function applySetting() {
  frames = 0;
  elapsed = 0;
  goodTime = 0;
  cooldown = WARMUP_SECONDS;
  const autoStart = isWebGPU() ? 0 : WEBGL_FALLBACK_QUALITY;
  setLevel(settings.quality === "auto" ? autoStart : Number(settings.quality));
}

export function updateQuality(dt) {
  if (settings.quality !== "auto" || document.hidden) return;
  if (cooldown > 0) {
    cooldown -= dt;
    return;
  }
  frames++;
  elapsed += dt;
  if (elapsed < WINDOW_SECONDS) return;

  const fps = frames / elapsed;
  frames = 0;
  if (fps < QUALITY_DOWN_FPS && level < QUALITY_LEVELS.length - 1) {
    setLevel(level + 1);
    cooldown = COOLDOWN_SECONDS;
    goodTime = 0;
  } else if (fps > QUALITY_UP_FPS && level > 0) {
    goodTime += elapsed;
    if (goodTime >= UP_AFTER_SECONDS) {
      setLevel(level - 1);
      cooldown = COOLDOWN_SECONDS;
      goodTime = 0;
    }
  } else {
    goodTime = 0;
  }
  elapsed = 0;
}
