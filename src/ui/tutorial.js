// Tutorial interativo: cada passo só avança quando o usuário faz o gesto de verdade.
import { settings, saveSettings } from "../settings.js";
import { playClick } from "../audio/sfx.js";

const STEPS = [
  { event: "hand", title: "Mostre a mão", text: "Levante uma mão aberta na frente da câmera." },
  { event: "zoom", title: "Zoom", text: "Feche o punho e empurre em direção à câmera para aproximar. Para afastar, abra a mão e puxe para trás." },
  { event: "shape", title: "Texto", text: "Faça um L com o polegar e o indicador (outros dedos dobrados) e segure até o anel encher." },
  { event: "explode", title: "Explodir", text: "Com a mão aberta, empurre rápido em direção à câmera, ou mexa as duas mãos rápido ao mesmo tempo." },
  { event: "two-hands", title: "Girar", text: "Mostre as duas mãos: a esquerda para os lados gira para os lados, a direita para cima ou baixo gira para cima ou baixo." }
];

let index = -1;
let progress = 0;

const el = (id) => document.getElementById(id);

function render() {
  const step = STEPS[index];
  el("tutorial-step").textContent = `Tutorial ${index + 1}/${STEPS.length} · ${step.title}`;
  el("tutorial-text").textContent = step.text;
  el("tutorial-dots").innerHTML = STEPS.map((_, i) =>
    `<span class="${i < index ? "done" : i === index ? "current" : ""}"></span>`
  ).join("");
}

function finish(completed) {
  index = -1;
  el("tutorial").classList.remove("visible");
  settings.tutorialDone = true;
  saveSettings();
  if (completed) {
    playClick();
    el("hint").textContent = "Tutorial concluído! Veja mais em “Gestos e atalhos”.";
    el("hint").classList.add("visible");
    setTimeout(() => el("hint").classList.remove("visible"), 3500);
  }
}

export function isTutorialActive() {
  return index >= 0;
}

export function startTutorial() {
  index = 0;
  progress = 0;
  el("tutorial").classList.add("visible");
  render();
}

export function setupTutorial() {
  el("btn-tutorial-skip").addEventListener("click", () => finish(false));
}

// Os gestos avisam o tutorial do que acabou de acontecer.
// "rotate" vem com quanto girou (radianos); os demais contam na hora.
export function notifyTutorial(event, amount = 1) {
  if (index < 0 || STEPS[index].event !== event) return;
  progress += amount;
  const needed = event === "rotate" ? 2.5 : 1;
  if (progress < needed) return;
  progress = 0;
  playClick();
  index++;
  if (index >= STEPS.length) finish(true);
  else render();
}
