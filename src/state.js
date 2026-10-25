// Estado compartilhado entre a cena, os gestos e a interface.
import { SHAPES, DEFAULT_ZOOM_LEVEL } from "./config.js";
import { settings } from "./settings.js";

// Relógio do app: getDelta() devolve os segundos desde a chamada anterior e soma em elapsedTime.
// (O THREE.Clock foi descontinuado no Three.js r183.)
export const clock = {
  elapsedTime: 0,
  last: performance.now(),
  getDelta() {
    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now;
    this.elapsedTime += dt;
    return dt;
  }
};

export const state = {
  currentModel: SHAPES.includes(settings.shape) ? settings.shape : "tree",
  gestureScale: 1.0,
  targetGestureScale: 1.0,
  // Índice em ZOOM_LEVELS (começa em DEFAULT_ZOOM_LEVEL, a visão completa).
  zoomLevel: DEFAULT_ZOOM_LEVEL,
  targetRotationX: 0,
  targetRotationY: 0,
  // Giro em torno do eixo que aponta para a tela (hoje nenhum gesto mexe; só volta a 0 ao centralizar).
  targetRotationZ: 0,
  paintMode: false,
  musicMode: false,
  // Volume geral e dos graves vindos do microfone (0 a 1, já suavizados).
  audioLevel: 0,
  audioBass: 0,
  recording: false,
  idleRotation: 0,
  breathAmount: 0,
  explodeStart: -10,
  lastExplodeTime: -10,
  lastHandTime: -10,
  baseHue: 0.468,
  accentHex: "#00ffcc",
  // Proporção da imagem da câmera (x é normalizado pela largura e y pela altura). Atualizada quando a câmera liga.
  cameraAspect: 4 / 3
};

// Giro ocioso: volta completa nas formas 3D. O texto fica parado de frente, para ser lido.
export function idleYaw() {
  return state.currentModel === "text" ? 0 : state.idleRotation;
}
