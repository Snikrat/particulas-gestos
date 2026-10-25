// Desenho dos pontos da mão: na imagem da webcam e por cima das partículas.
import { imageToScreen } from "./geometry.js";
import { settings } from "../settings.js";
import { state } from "../state.js";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

let webcamCtx, overlayCanvas, overlayCtx;

export function initSkeleton(webcamCanvas, screenCanvas) {
  webcamCtx = webcamCanvas.getContext("2d");
  overlayCanvas = screenCanvas;
  overlayCtx = screenCanvas.getContext("2d");
  resizeOverlay();
  window.addEventListener("resize", resizeOverlay);
}

function resizeOverlay() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  overlayCanvas.width = window.innerWidth * dpr;
  overlayCanvas.height = window.innerHeight * dpr;
  overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Linhas brancas ligando as juntas, bolinhas brancas nas juntas e maiores, na cor escolhida, nas pontas dos dedos.
function drawSkeleton(ctx, pts, radius, lineWidth) {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
  }
  ctx.stroke();

  ctx.shadowColor = state.accentHex;
  for (let i = 0; i < pts.length; i++) {
    const tip = FINGERTIPS.has(i);
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, tip ? radius * 1.5 : radius, 0, Math.PI * 2);
    ctx.fillStyle = tip ? state.accentHex : "#ffffff";
    ctx.shadowBlur = tip ? radius * 3 : 0;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// hands: lista com os 21 pontos de cada mão detectada (uma ou duas).
export function drawHands(hands) {
  // Na webcam: coordenadas da imagem direto (a caixa já é espelhada junto com o vídeo).
  const { width, height } = webcamCtx.canvas;
  webcamCtx.clearRect(0, 0, width, height);
  const scale = width / 640;
  overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const points of hands) {
    drawSkeleton(webcamCtx, points.map((p) => ({ x: p.x * width, y: p.y * height })), 7 * scale, 3 * scale);

    // Na tela: mesmo mapeamento do cursor do indicador.
    if (settings.showSkeleton) {
      const pts = points.map((p) => {
        const s = imageToScreen(p, false);
        return { x: (s.x + 1) * 0.5 * window.innerWidth, y: (1 - s.y) * 0.5 * window.innerHeight };
      });
      drawSkeleton(overlayCtx, pts, 6, 2.5);
    }
  }
}

export function clearHand() {
  webcamCtx.clearRect(0, 0, webcamCtx.canvas.width, webcamCtx.canvas.height);
  overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

export function clearScreenSkeleton() {
  overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}
