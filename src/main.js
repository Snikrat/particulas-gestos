// Ponto de entrada: monta a cena, o painel e liga a câmera.
import "./style.css";
import { settings } from "./settings.js";
import { clock } from "./state.js";
import { initScene, renderFrame, isWebGPU } from "./scene/particles.js";
import { initQuality, updateQuality } from "./scene/quality.js";
import { initSkeleton } from "./hand/skeleton.js";
import { startTracking, detectHands } from "./hand/tracker.js";
import { processHand } from "./gestures.js";
import { updateMusic } from "./audio/music.js";
import { unlockAudioOnFirstInteraction } from "./audio/context.js";
import { loadSavedImage, setARMode } from "./actions.js";
import { setupPanel, showQualityLevel } from "./ui/panel.js";
import { startTutorial } from "./ui/tutorial.js";
import { setStatusText, hideLoading, setLoadingText } from "./ui/feedback.js";

const webcamCanvas = document.getElementById("webcam-overlay");

// O texto salvo precisa estar no campo antes de montar a forma inicial.
document.getElementById("text-input").value = settings.text || "OLÁ";

// O WebGPU precisa de um momento para iniciar a placa de vídeo antes do primeiro quadro.
await initScene(document.getElementById("canvas-container"));
console.info(isWebGPU() ? "Renderizando com WebGPU" : "WebGPU indisponível: usando WebGL 2");
initSkeleton(webcamCanvas, document.getElementById("hand-overlay"));
setupPanel();
initQuality(showQualityLevel);
unlockAudioOnFirstInteraction();
loadSavedImage();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const results = detectHands();
  if (results) processHand(results);
  updateMusic(dt);
  updateQuality(dt);
  renderFrame(dt);
}
animate();

startTracking(document.getElementById("webcam"), webcamCanvas, setStatusText)
  .then(() => {
    hideLoading();
    setStatusText("Pronto! Mostre a mão para a câmera.");
    if (settings.arMode) setARMode(true, true);
    if (!settings.tutorialDone) startTutorial();
  })
  .catch((err) => {
    if (err.message === "camera") {
      setLoadingText("Falha ao acessar a câmera: permita a câmera no navegador e abra a página por localhost / 127.0.0.1.");
      setStatusText("A câmera não iniciou. Você ainda pode girar as partículas arrastando com o mouse.");
      hideLoading(5000);
    } else {
      setLoadingText("Falha ao carregar o detector de mãos. As partículas continuam funcionando.");
      setStatusText("O detector de gestos não carregou, mas as partículas estão rodando.");
      hideLoading(4000);
    }
  });
