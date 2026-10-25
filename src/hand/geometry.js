// Medidas da mão a partir dos 21 pontos do MediaPipe.
import * as THREE from "three";
import { PALM_WIDTH_RATIO } from "../config.js";

export function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Ângulo (graus) no ponto b entre os segmentos b->a e b->c, em 3D.
function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const len = Math.hypot(v1x, v1y, v1z) * Math.hypot(v2x, v2y, v2z) || 1e-6;
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dot / len, -1, 1)));
}

// Dobra de indicador, médio, anelar e mindinho (juntas PIP + DIP). Dedo esticado ~0°, dobrado ~150°+.
// Usa os pontos 3D, então não depende de como a mão está virada para a câmera.
export function fingerBends(points) {
  const fingers = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  return fingers.map(([mcp, pip, dip, tip]) =>
    (180 - jointAngle(points[mcp], points[pip], points[dip])) +
    (180 - jointAngle(points[pip], points[dip], points[tip]))
  );
}

// Tamanho aparente da palma na imagem, em unidades da altura da imagem.
// Pega o maior entre comprimento e largura, então inclinar a mão num eixo quase não altera o valor.
export function palmSizeInImage(points, cameraAspect) {
  const dist = (a, b) => Math.hypot((a.x - b.x) * cameraAspect, a.y - b.y);
  const length = dist(points[0], points[9]);
  const width = dist(points[5], points[17]) / PALM_WIDTH_RATIO;
  return Math.max(length, width);
}

// Converte um ponto da imagem da câmera (espelhada) para a tela, de -1 a 1.
// A área central de 80% da imagem já cobre a tela inteira, para não precisar esticar o braço.
export function imageToScreen(p, clamp = true) {
  const x = ((1 - p.x) - 0.5) / 0.4;
  const y = -(p.y - 0.5) / 0.4;
  return clamp
    ? { x: THREE.MathUtils.clamp(x, -1, 1), y: THREE.MathUtils.clamp(y, -1, 1) }
    : { x, y };
}
