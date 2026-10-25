// Modo "pintar no ar": a ponta do indicador deixa um rastro de pontos de luz que somem com o tempo.
// Os pontos são escritos pelo processador (onde o dedo passou) e animados no shader (subir e sumir).
import * as THREE from "three/webgpu";
import { uniform, instancedArray, vec4, float, exp, fract, step, smoothstep } from "three/tsl";
import { hsl2rgb, softCircle } from "./tsl-utils.js";
import { PAINT_PARTICLES, PAINT_LIFE } from "../config.js";

// Pontos de tinta por unidade de distância percorrida pelo dedo (no mundo 3D).
const DENSITY = 6;
const MAX_PER_FRAME = 120;

// a: posição (xyz) + momento em que nasceu (w). b: velocidade (xyz) + semente aleatória (w).
let bufferA, bufferB;
let next = 0;
let lastPoint = null;

const uTime = uniform(0);
const uLife = uniform(PAINT_LIFE);
const uBaseHue = uniform(0);

export function initTrail(scene) {
  const a = new Float32Array(PAINT_PARTICLES * 4);
  const b = new Float32Array(PAINT_PARTICLES * 4);
  for (let i = 0; i < PAINT_PARTICLES; i++) {
    a[i * 4 + 3] = -1000; // ainda não nasceu
    b[i * 4 + 3] = Math.random();
  }
  bufferA = instancedArray(a, "vec4");
  bufferB = instancedArray(b, "vec4");

  const attrA = bufferA.toAttribute();
  const attrB = bufferB.toAttribute();
  const age = uTime.sub(attrA.w);
  const alive = step(0, age).mul(step(age, uLife));
  const k = age.div(uLife);
  const seed = attrB.w;

  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  // Flutua devagar a partir de onde nasceu; vai encolhendo um pouco.
  material.positionNode = attrA.xyz.add(attrB.xyz.mul(age));
  material.scaleNode = seed.mul(0.35).add(0.25).mul(float(1).sub(k.mul(0.5))).mul(alive);
  material.colorNode = vec4(hsl2rgb(fract(uBaseHue.add(seed.sub(0.5).mul(0.12))), 0.9, 0.55), 1);
  // Brilho forte ao nascer, depois some suavemente nos últimos 40% da vida.
  material.opacityNode = softCircle()
    .mul(float(1).sub(smoothstep(0.6, 1, k)))
    .mul(exp(age.mul(-3)).mul(0.4).add(0.6))
    .mul(alive);

  const points = new THREE.Sprite(material);
  points.count = PAINT_PARTICLES;
  points.frustumCulled = false;
  scene.add(points);
}

// Solta tinta ao longo do caminho entre o último ponto e o atual, para o traço sair contínuo.
export function paintAt(point, now) {
  if (!lastPoint) {
    lastPoint = point.clone();
    return;
  }
  const distance = lastPoint.distanceTo(point);
  const count = Math.min(Math.max(Math.round(distance * DENSITY), 2), MAX_PER_FRAME);
  const a = bufferA.value.array;
  const b = bufferB.value.array;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const j = next * 4;
    next = (next + 1) % PAINT_PARTICLES;
    a[j] = THREE.MathUtils.lerp(lastPoint.x, point.x, t) + (Math.random() - 0.5) * 0.4;
    a[j + 1] = THREE.MathUtils.lerp(lastPoint.y, point.y, t) + (Math.random() - 0.5) * 0.4;
    a[j + 2] = THREE.MathUtils.lerp(lastPoint.z, point.z, t) + (Math.random() - 0.5) * 0.4;
    a[j + 3] = now;
    // Flutua devagar, levemente para cima, como fumaça luminosa.
    b[j] = (Math.random() - 0.5) * 0.6;
    b[j + 1] = (Math.random() - 0.3) * 0.6;
    b[j + 2] = (Math.random() - 0.5) * 0.6;
  }
  lastPoint.copy(point);
  bufferA.value.needsUpdate = true;
  bufferB.value.needsUpdate = true;
}

// O dedo parou de pintar: o próximo traço começa do zero (não liga com o anterior).
export function liftPen() {
  lastPoint = null;
}

export function clearPaint() {
  const a = bufferA.value.array;
  for (let i = 0; i < PAINT_PARTICLES; i++) a[i * 4 + 3] = -1000;
  bufferA.value.needsUpdate = true;
  lastPoint = null;
}

export function updateTrail(now, baseHue) {
  uTime.value = now;
  uBaseHue.value = baseHue;
}
