// Modo música: escuta o microfone e mede o volume geral e dos graves para as partículas reagirem.
import { getAudioContext } from "./context.js";
import { state } from "../state.js";

let stream = null;
let analyser = null;
let bins = null;

export async function startMusic() {
  const ctx = getAudioContext();
  // Sem filtros de voz: eles cortam a música (são feitos para chamadas).
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false
  });
  const source = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  bins = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  state.musicMode = true;
}

export function stopMusic() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  analyser = null;
  state.musicMode = false;
  state.audioLevel = 0;
  state.audioBass = 0;
}

// Sobe rápido nas batidas e desce devagar, para o efeito "pulsar" em vez de tremer.
function follow(current, target, dt) {
  const rate = target > current ? 25 : 4;
  return current + (target - current) * Math.min(rate * dt, 1);
}

export function updateMusic(dt) {
  if (!analyser) return;
  analyser.getByteFrequencyData(bins);
  // Com fftSize 512 a 48 kHz, cada faixa tem ~94 Hz: as faixas 1 a 3 são os graves (bumbo, baixo).
  let bass = 0;
  for (let i = 1; i <= 3; i++) bass += bins[i];
  bass /= 3 * 255;
  let total = 0;
  const limit = Math.floor(bins.length * 0.6);
  for (let i = 0; i < limit; i++) total += bins[i];
  const level = total / (limit * 255);
  // Ignora o ruído de fundo e amplia o resto, para música baixa também aparecer.
  const shape = (v, floor) => Math.min(Math.max((v - floor) / (1 - floor), 0) * 1.6, 1);
  state.audioBass = follow(state.audioBass, shape(bass, 0.35), dt);
  state.audioLevel = follow(state.audioLevel, shape(level, 0.12), dt);
}
