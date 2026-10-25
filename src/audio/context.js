// Um único AudioContext para o app. O navegador só deixa tocar som depois de um clique ou tecla,
// então ele é "destravado" na primeira interação.
let ctx = null;

export function getAudioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudioOnFirstInteraction() {
  const unlock = () => {
    getAudioContext();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}
