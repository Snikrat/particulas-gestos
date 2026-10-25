// Suavização dos 21 pontos de cada mão com o filtro One Euro (um conjunto de filtros por mão).
import * as THREE from "three";

// Filtro One Euro: suaviza bastante com a mão parada e quase nada com a mão em movimento rápido.
class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 3.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value, t) {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuroFilter.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuroFilter.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

// Um conjunto por mão: [0] = mão mais à esquerda na imagem, [1] = mão mais à direita.
const banks = [0, 1].map(() => Array.from({ length: 21 * 3 }, () => new OneEuroFilter()));

// A "Suavidade" ajusta o filtro: mais suave corta mais tremedeira, mas a mão demora um pouco mais a responder.
export function applySmoothness(smoothness) {
  const minCutoff = THREE.MathUtils.lerp(2.5, 0.5, smoothness);
  const beta = THREE.MathUtils.lerp(3.0, 1.0, smoothness);
  banks.flat().forEach((f) => { f.minCutoff = minCutoff; f.beta = beta; });
}

export function resetLandmarkFilters() {
  banks.flat().forEach((f) => { f.x = null; f.dx = 0; });
}

export function smoothLandmarks(landmarks, t, slot = 0) {
  const bank = banks[slot];
  return landmarks.map((p, i) => ({
    x: bank[i * 3].filter(p.x, t),
    y: bank[i * 3 + 1].filter(p.y, t),
    z: bank[i * 3 + 2].filter(p.z, t)
  }));
}
