// Geração das formas: posição de cada partícula e seu tom de cor.
import { PARTICLE_COUNT } from "../config.js";

const shapeCache = {};

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

// Tom de cada partícula: [matiz, saturação, luminosidade, absoluto].
// absoluto=0: matiz é um deslocamento em relação à cor escolhida; absoluto=1: matiz fixo (ex.: estrela dourada).
function setTone(tone, i, hue, sat, light, absolute = 0) {
  const i4 = i * 4;
  tone[i4] = hue;
  tone[i4 + 1] = sat;
  tone[i4 + 2] = light;
  tone[i4 + 3] = absolute;
}

function setPos(pos, i, x, y, z) {
  const i3 = i * 3;
  pos[i3] = x;
  pos[i3 + 1] = y;
  pos[i3 + 2] = z;
}

function buildTree(pos, tone) {
  const ornamentHues = [0.0, 0.13, 0.6, 0.83];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i < PARTICLE_COUNT * 0.08) {
      // Estrela no topo
      const angle = Math.random() * Math.PI * 2;
      const starWave = Math.abs(Math.sin(angle * 5));
      const r = (1.8 + starWave * 3.0) * Math.sqrt(Math.random());
      setPos(pos, i, r * Math.cos(angle), 20 + (Math.random() - 0.5) * 1.5, r * Math.sin(angle) * 0.45);
      setTone(tone, i, 0.13, 0.9, 0.6 + Math.random() * 0.15, 1);
    } else if (i < PARTICLE_COUNT * 0.92) {
      // Copa em camadas
      const h = Math.random() * 32 - 14;
      const layerNormalized = (h + 14) / 32;
      const layerProgress = (layerNormalized * 4) % 1.0;
      let baseRadius = (1.0 - layerNormalized) * 18;
      baseRadius *= Math.pow(layerProgress, 0.42);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.max(0, baseRadius * Math.sqrt(Math.random()) + (Math.random() - 0.5) * 2.5);
      setPos(pos, i, Math.cos(angle) * r, h, Math.sin(angle) * r);
      if (Math.random() < 0.035) {
        setTone(tone, i, ornamentHues[Math.floor(Math.random() * ornamentHues.length)], 0.95, 0.6, 1);
      } else {
        setTone(tone, i, (Math.random() - 0.5) * 0.08, 0.85, 0.4 + Math.random() * 0.15);
      }
    } else {
      // Tronco
      const h = Math.random() * 5 - 19;
      const r = Math.random() * 2.2;
      const angle = Math.random() * Math.PI * 2;
      setPos(pos, i, Math.cos(angle) * r, h, Math.sin(angle) * r);
      setTone(tone, i, 0.07, 0.6, 0.3, 1);
    }
  }
}

function buildSaturn(pos, tone) {
  const bandHues = [-0.06, -0.02, 0.03, 0.08];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i < PARTICLE_COUNT * 0.42) {
      // Planeta
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const latFlatten = 0.82 + Math.random() * 0.06;
      const r = 11.5 * Math.cbrt(Math.random());
      const y = r * Math.sin(phi) * Math.sin(theta) * latFlatten;
      setPos(pos, i, r * Math.sin(phi) * Math.cos(theta), y, r * Math.cos(phi));
      setTone(tone, i, 0.05 * Math.sin(y * 0.9), 0.7, 0.45 + Math.random() * 0.1);
    } else {
      // Anéis
      const ringBand = Math.random();
      const bandIndex = ringBand < 0.22 ? 0 : ringBand < 0.48 ? 1 : ringBand < 0.72 ? 2 : 3;
      const bandBase = [14.5, 18.5, 23.5, 28.5][bandIndex];
      const rRing = bandBase + Math.random() * 3.5 + Math.sin(bandBase * 1.7 + i * 0.013) * 0.9;
      const thetaRing = Math.random() * Math.PI * 2;
      const ringRipple = Math.sin(thetaRing * 10 + rRing * 0.9) * 0.45 + Math.sin(thetaRing * 23) * 0.18;
      const ringThickness = (Math.random() - 0.5) * (0.45 + ringBand * 0.85);
      setPos(pos, i, (rRing + ringRipple) * Math.cos(thetaRing), ringThickness, (rRing + ringRipple) * Math.sin(thetaRing));
      setTone(tone, i, bandHues[bandIndex], 0.8, 0.4 + Math.random() * 0.15);
    }
  }
}

function buildHeart(pos, tone) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = Math.PI * 2 * Math.random();
    const u = Math.PI * (Math.random() - 0.5);
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const z = 6 * Math.sin(u) * (1 - Math.abs(Math.sin(t)));
    setPos(pos, i, x * 1.35, y * 1.35, z * 1.35);
    setTone(tone, i, (Math.random() - 0.5) * 0.06, 0.85, 0.45 + Math.random() * 0.12);
  }
}

function buildGalaxy(pos, tone) {
  const arms = 3;
  // Inclina o disco para ficar quase de frente para a câmera.
  const tilt = 1.1;
  const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
  const setTilted = (i, x, y, z) => setPos(pos, i, x, y * cosT - z * sinT, y * sinT + z * cosT);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i < PARTICLE_COUNT * 0.15) {
      // Núcleo brilhante
      const r = 5 * Math.pow(Math.random(), 1.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      setTilted(i, r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.5, r * Math.sin(phi) * Math.sin(theta));
      setTone(tone, i, 0.08, 0.45, 0.65 + Math.random() * 0.1);
    } else {
      // Braços em espiral
      const radius = 3 + Math.pow(Math.random(), 0.8) * 26;
      const arm = Math.floor(Math.random() * arms);
      const angle = (arm / arms) * Math.PI * 2 + radius * 0.22;
      const spread = 1 + radius * 0.09;
      const x = Math.cos(angle) * radius + gauss() * spread;
      const z = Math.sin(angle) * radius + gauss() * spread;
      const y = gauss() * 1.4 * (1 - radius / 34);
      setTilted(i, x, y, z);
      const k = radius / 29;
      setTone(tone, i, -0.08 + 0.16 * k, 0.85, 0.55 - k * 0.15);
    }
  }
}

function buildSphere(pos, tone) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const shellCount = Math.floor(PARTICLE_COUNT * 0.85);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let x, y, z;
    if (i < shellCount) {
      // Casca com distribuição de Fibonacci (pontos bem espaçados)
      const yy = 1 - (i / (shellCount - 1)) * 2;
      const ring = Math.sqrt(1 - yy * yy);
      const theta = golden * i;
      const r = 19 + gauss() * 0.4;
      x = Math.cos(theta) * ring * r;
      y = yy * r;
      z = Math.sin(theta) * ring * r;
    } else {
      // Interior
      const r = 14 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.cos(phi);
      z = r * Math.sin(phi) * Math.sin(theta);
    }
    setPos(pos, i, x, y, z);
    setTone(tone, i, 0.12 * (y / 19), 0.85, i < shellCount ? 0.5 : 0.35);
  }
}

function buildDNA(pos, tone) {
  const height = 48;
  const radius = 8;
  const twist = 0.35;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i < PARTICLE_COUNT * 0.7) {
      // Duas fitas
      const strand = i % 2;
      const y = Math.random() * height - height / 2;
      const a = y * twist + strand * Math.PI;
      setPos(pos, i, Math.cos(a) * radius + gauss() * 0.6, y + gauss() * 0.3, Math.sin(a) * radius + gauss() * 0.6);
      setTone(tone, i, strand ? 0.5 : 0.0, 0.85, 0.5);
    } else {
      // Degraus entre as fitas
      const step = Math.floor(Math.random() * Math.floor(height / 2.2));
      const y = -height / 2 + step * 2.2;
      const a = y * twist;
      const t = Math.random() * 2 - 1;
      setPos(pos, i, Math.cos(a) * radius * t + gauss() * 0.25, y + gauss() * 0.25, Math.sin(a) * radius * t + gauss() * 0.25);
      setTone(tone, i, 0.25, 0.3, 0.6);
    }
  }
}

function buildText(pos, tone, text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  let fontSize = 220;
  ctx.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const measured = ctx.measureText(text).width;
  if (measured > 980) {
    fontSize = Math.floor(fontSize * 980 / measured);
    ctx.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const points = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (data[(y * canvas.width + x) * 4 + 3] > 128) {
        points.push(x, y);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  if (points.length === 0) return false;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const k = Math.min(56 / Math.max(maxX - minX, 1), 26 / Math.max(maxY - minY, 1));
  const count = points.length / 2;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = Math.floor(Math.random() * count) * 2;
    const px = points[p] + (Math.random() - 0.5) * 2;
    const py = points[p + 1] + (Math.random() - 0.5) * 2;
    setPos(pos, i, (px - cx) * k, -(py - cy) * k, (Math.random() - 0.5) * 3);
    setTone(tone, i, -0.1 + 0.2 * ((px - minX) / Math.max(maxX - minX, 1)), 0.85, 0.45 + Math.random() * 0.12);
  }
  return true;
}

// ---------- Imagem enviada ----------

let imagePixels = null;

// Recebe um ImageData (já reduzido) da imagem que o usuário enviou.
export function setImagePixels(pixels) {
  imagePixels = pixels;
}

export function hasImage() {
  return imagePixels !== null;
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

// Cada partícula pega a cor real de um pixel. Pixels mais claros ficam mais à frente (relevo).
// Imagens com transparência (logos) usam só a parte visível; fotos ignoram o preto puro.
function buildImage(pos, tone) {
  const { width, height, data } = imagePixels;
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) { hasAlpha = true; break; }
  }

  const candidates = [];
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (hasAlpha ? data[i + 3] > 128 : lum > 0.06) candidates.push(i);
  }
  if (candidates.length === 0) return false;

  const k = Math.min(56 / width, 32 / height);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const px = (idx / 4) % width;
    const py = Math.floor(idx / 4 / width);
    const r = data[idx] / 255, g = data[idx + 1] / 255, b = data[idx + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    setPos(
      pos, i,
      (px + Math.random() - 0.5 - width / 2) * k,
      -(py + Math.random() - 0.5 - height / 2) * k,
      (lum - 0.5) * 6 + (Math.random() - 0.5) * 1.2
    );
    const [h, s, l] = rgbToHsl(r, g, b);
    // Luminosidade limitada: com brilho somado (aditivo), cores claras viram branco estourado.
    setTone(tone, i, h, s, Math.min(Math.max(l, 0.12), 0.55), 1);
  }
  return true;
}

// Embaralha a ordem das partículas. Assim, quando a qualidade desenha só as primeiras N,
// elas continuam espalhadas pela forma inteira (várias formas são montadas por partes, em ordem).
function shuffleParticles(pos, tone) {
  for (let i = PARTICLE_COUNT - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    for (let k = 0; k < 3; k++) {
      const a = i * 3 + k, b = j * 3 + k;
      const tmp = pos[a]; pos[a] = pos[b]; pos[b] = tmp;
    }
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = j * 4 + k;
      const tmp = tone[a]; tone[a] = tone[b]; tone[b] = tmp;
    }
  }
}

const BUILDERS = {
  tree: buildTree,
  saturn: buildSaturn,
  heart: buildHeart,
  galaxy: buildGalaxy,
  sphere: buildSphere,
  dna: buildDNA
};

// Retorna { pos, tone } da forma. As formas fixas são geradas uma vez e guardadas;
// texto e imagem são refeitos sempre (mudam com o que o usuário digita ou envia).
export function getShape(name, text = "OLÁ") {
  if (name === "text" || name === "image") {
    if (name === "image" && !imagePixels) return getShape("tree");
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const tone = new Float32Array(PARTICLE_COUNT * 4);
    if (name === "image") {
      if (!buildImage(pos, tone)) return getShape("tree");
    } else if (!buildText(pos, tone, text.trim() || "OLÁ")) {
      buildText(pos, tone, "OLÁ");
    }
    shuffleParticles(pos, tone);
    return { pos, tone };
  }
  if (!shapeCache[name]) {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const tone = new Float32Array(PARTICLE_COUNT * 4);
    BUILDERS[name](pos, tone);
    shuffleParticles(pos, tone);
    shapeCache[name] = { pos, tone };
  }
  return shapeCache[name];
}
