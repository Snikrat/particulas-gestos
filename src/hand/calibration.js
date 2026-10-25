// Calibração: mede a dobra dos dedos com a mão aberta e com o punho, e ajusta os limites de detecção.
import { DEFAULT_CALIBRATION, CALIBRATION_KEY } from "../config.js";

const PREP_SECONDS = 1.5;
const CAPTURE_SECONDS = 1.5;

function loadCalibration() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALIBRATION_KEY));
    if (saved && saved.fist - saved.open > 40) return saved;
  } catch (e) {}
  return { ...DEFAULT_CALIBRATION };
}

function thresholdsFrom({ open, fist }) {
  const range = fist - open;
  return {
    // Histerese do punho: precisa passar de fistClose para fechar e cair abaixo de fistOpen para abrir.
    fistClose: open + range * 0.65,
    fistOpen: open + range * 0.4,
    // Dedo conta como esticado abaixo de fingerExt e como dobrado acima de fingerCurl.
    fingerExt: open + range * 0.3,
    fingerCurl: open + range * 0.55
  };
}

export let thresholds = thresholdsFrom(loadCalibration());

let calib = null;

export function isCalibrating() {
  return calib !== null;
}

export function startCalibration(now) {
  calib = { phase: "prep-open", t0: now, samples: [], open: 0 };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Avança a calibração. meanBend é null quando não há mão na câmera.
// Retorna { text } enquanto calibra, ou { message } quando termina (com sucesso ou não).
export function updateCalibration(meanBend, now) {
  const elapsed = now - calib.t0;

  if (calib.phase === "prep-open" || calib.phase === "prep-fist") {
    if (elapsed >= PREP_SECONDS) {
      calib.phase = calib.phase === "prep-open" ? "open" : "fist";
      calib.t0 = now;
      calib.samples = [];
    }
  } else {
    if (meanBend !== null) calib.samples.push(meanBend);
    if (elapsed >= CAPTURE_SECONDS && calib.samples.length >= 10) {
      const value = median(calib.samples);
      if (calib.phase === "open") {
        calib.open = value;
        calib.phase = "prep-fist";
        calib.t0 = now;
      } else {
        const result = { open: calib.open, fist: value };
        calib = null;
        if (result.fist - result.open > 40) {
          thresholds = thresholdsFrom(result);
          try { localStorage.setItem(CALIBRATION_KEY, JSON.stringify(result)); } catch (e) {}
          return { message: `Calibrado! Aberta: ${Math.round(result.open)}° · Punho: ${Math.round(result.fist)}°` };
        }
        return { message: "Calibração falhou: a mão aberta e o punho ficaram parecidos demais. Tente de novo." };
      }
    }
  }

  const step = calib.phase.endsWith("open") ? "1/2: mostre a MÃO ABERTA" : "2/2: feche o PUNHO";
  const action = calib.phase.startsWith("prep") ? "prepare-se..." : "segure assim...";
  const handNote = meanBend === null ? "<br>(nenhuma mão na câmera)" : "";
  return { text: `Calibração ${step}<br>${action}${handNote}` };
}
