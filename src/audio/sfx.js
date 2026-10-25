// Efeitos sonoros sintetizados (sem arquivos de áudio): explosão e troca de forma.
import { getAudioContext } from "./context.js";
import { settings } from "../settings.js";

const VOLUME = 0.25;

function ready() {
  if (!settings.sfx) return null;
  const ctx = getAudioContext();
  // Antes do primeiro clique/tecla o navegador não deixa tocar; nesse caso fica em silêncio.
  return ctx.state === "running" ? ctx : null;
}

// Estouro grave: ruído passando por um filtro que vai fechando.
export function playExplosion() {
  const ctx = ready();
  if (!ctx) return;
  const duration = 1.2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(VOLUME, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start();
}

// Brilho suave: duas notas subindo, como um sininho.
export function playMorph() {
  const ctx = ready();
  if (!ctx) return;
  [660, 990].forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(VOLUME * 0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });
}

// Clique curto para fotos e para o fim do tutorial.
export function playClick() {
  const ctx = ready();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(VOLUME * 0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}
