// Mensagens para o usuário: caixa de status do painel, avisos rápidos e cursor do indicador.
import { clock } from "../state.js";

const statusBox = () => document.getElementById("gesture-status");
const cursor = () => document.getElementById("hand-cursor");

let flashText = "";
let flashUntil = 0;

// Mensagem que tem prioridade sobre o status normal por alguns segundos.
export function flashStatus(text, seconds = 2.5) {
  flashText = text;
  flashUntil = clock.elapsedTime + seconds;
}

// Mostra o status (HTML) no painel, a não ser que uma mensagem de flashStatus ainda esteja valendo.
export function setStatus(html, active) {
  const box = statusBox();
  box.classList.toggle("active", active);
  if (clock.elapsedTime < flashUntil) box.textContent = flashText;
  else box.innerHTML = html;
}

// Status fixo, sem passar pelo flash (mensagens de carregamento e erro).
export function setStatusText(text) {
  statusBox().textContent = text;
}

let hintTimer = null;
export function showHint(text) {
  const hint = document.getElementById("hint");
  hint.textContent = text;
  hint.classList.add("visible");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.remove("visible"), 2500);
}

export function moveCursor(screenX, screenY, { fist, paint = false }) {
  const el = cursor();
  el.style.left = `${screenX}px`;
  el.style.top = `${screenY}px`;
  el.classList.add("visible");
  el.classList.toggle("fist", fist);
  el.classList.toggle("paint", paint);
}

export function hideCursor() {
  cursor().classList.remove("visible", "fist", "paint");
  setCursorProgress(0);
}

// Anel em volta do cursor que enche enquanto um gesto é segurado (ex.: 3 dedos para trocar de forma).
// progress de 0 a 1; com 0 o anel e o texto somem.
const RING_LENGTH = 2 * Math.PI * 26;
export function setCursorProgress(progress, label = "") {
  const ring = document.getElementById("cursor-progress");
  const text = document.getElementById("cursor-label");
  ring.style.strokeDashoffset = `${RING_LENGTH * (1 - Math.min(Math.max(progress, 0), 1))}`;
  ring.parentElement.classList.toggle("active", progress > 0);
  text.textContent = label;
  text.classList.toggle("active", progress > 0 && label !== "");
}

export function hideLoading(delay = 0) {
  const loading = document.getElementById("loading");
  if (!loading) return;
  setTimeout(() => {
    loading.style.opacity = "0";
    setTimeout(() => loading.remove(), 500);
  }, delay);
}

export function setLoadingText(text) {
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = text;
}
