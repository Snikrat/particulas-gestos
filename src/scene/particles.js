// Cena 3D com WebGPU: as partículas têm física de verdade (posição e velocidade) calculada num
// compute shader. Cada uma é puxada por uma mola até o seu lugar na forma; explosão e troca de forma
// aplicam empurrões. Sem WebGPU, o Three.js roda o mesmo código em WebGL 2.
import * as THREE from "three/webgpu";
import {
  Fn, uniform, instancedArray, instanceIndex, vec3, vec4, float, hash, pass,
  sin, exp, mix, normalize, fract
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { getShape } from "./shapes.js";
import { hsl2rgb, softCircle } from "./tsl-utils.js";
import { initTrail, updateTrail } from "./trail.js";
import {
  PARTICLE_COUNT, BASE_MODEL_SCALE, IDLE_DELAY, EXPLODE_COOLDOWN, QUALITY_LEVELS,
  SPRING_STIFFNESS, SPRING_DRAG, EXPLOSION_IMPULSE, MORPH_KICK
} from "../config.js";
import { settings } from "../settings.js";
import { state, clock, idleYaw } from "../state.js";

let scene, camera, renderer, controls, renderPipeline, bloomNode, sceneColor;
let particleSystem, computeUpdate;
let targetBuffer, toneTargetBuffer;
let lastCameraDistance = 0;
let qualityBloom = 1;
let bloomEnabled = true;
let snapshotCallback = null;
let pendingImpulse = 0;
let pendingKick = 0;
let wasIdle = true;

// Fundo com a imagem da câmera (modo AR).
let arPlane = null;
let arVideo = null;
const AR_DISTANCE = 500;

// Valores que mudam a cada quadro e são lidos pelos shaders.
const u = {
  time: uniform(0),
  delta: uniform(0),
  scale: uniform(BASE_MODEL_SCALE),
  stiffness: uniform(SPRING_STIFFNESS),
  drag: uniform(SPRING_DRAG),
  impulse: uniform(0),
  kick: uniform(0),
  flow: uniform(1.5),
  baseHue: uniform(state.baseHue),
  audio: uniform(0),
  size: uniform(0.17),
  opacity: uniform(0.2)
};

export function getCanvas() {
  return renderer.domElement;
}

export function isWebGPU() {
  return renderer.backend.isWebGPUBackend === true;
}

// Proporção da janela; minimizada ela pode medir 0x0, e uma proporção 0 quebra a câmera.
function windowAspect() {
  return window.innerWidth > 0 && window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 1;
}

// Em telas estreitas (celular em pé), afasta a câmera para a figura caber na largura.
function cameraDistance() {
  return 66 * Math.max(1, 1.2 / windowAspect());
}

function createParticles() {
  const start = getShape(state.currentModel, settings.text);

  // Posição (xyz) + semente aleatória (w). Começam espalhadas numa esfera e voam até a forma ao abrir.
  const posArray = new Float32Array(PARTICLE_COUNT * 4);
  const targetArray = new Float32Array(PARTICLE_COUNT * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    v.randomDirection().multiplyScalar(40 + Math.random() * 40);
    posArray.set([v.x, v.y, v.z, Math.random()], i * 4);
    targetArray.set([start.pos[i * 3], start.pos[i * 3 + 1], start.pos[i * 3 + 2], 0], i * 4);
  }

  const posBuffer = instancedArray(posArray, "vec4");
  const velBuffer = instancedArray(PARTICLE_COUNT, "vec4");
  targetBuffer = instancedArray(targetArray, "vec4");
  const toneBuffer = instancedArray(new Float32Array(start.tone), "vec4");
  toneTargetBuffer = instancedArray(new Float32Array(start.tone), "vec4");

  computeUpdate = Fn(() => {
    const p = posBuffer.element(instanceIndex);
    const v = velBuffer.element(instanceIndex);
    const seed = p.w;
    const pos = p.xyz.toVar();
    const vel = v.xyz.toVar();
    const dt = u.delta;

    // Direção aleatória fixa de cada partícula (para explosão e redemoinho).
    const rnd = vec3(
      hash(instanceIndex),
      hash(instanceIndex.add(7919)),
      hash(instanceIndex.add(15485))
    ).sub(0.5).mul(2).toVar();

    // Empurrões de um quadro só: explosão (para fora do centro) e redemoinho ao trocar de forma.
    vel.addAssign(normalize(pos.add(rnd.mul(0.01))).mul(0.5).add(rnd).mul(u.impulse.mul(seed.add(0.5))));
    vel.addAssign(rnd.mul(u.kick.mul(seed.add(0.3))));

    // Mola até o lugar na forma. Rigidez um pouco diferente por partícula: chegam em ondas, não todas juntas.
    const goal = targetBuffer.element(instanceIndex).xyz.mul(u.scale);
    const acc = goal.sub(pos).mul(u.stiffness.mul(seed.mul(0.6).add(0.7))).toVar();


    // Correnteza suave para as partículas nunca ficarem totalmente paradas.
    acc.addAssign(vec3(
      sin(pos.y.mul(0.15).add(u.time.mul(0.7)).add(seed.mul(6.28))),
      sin(pos.z.mul(0.15).add(u.time.mul(0.6)).add(seed.mul(3.0))),
      sin(pos.x.mul(0.15).add(u.time.mul(0.8)))
    ).mul(u.flow));

    vel.assign(vel.mul(exp(u.drag.mul(dt).negate())).add(acc.mul(dt)));
    pos.addAssign(vel.mul(dt));
    p.assign(vec4(pos, seed));
    v.assign(vec4(vel, 0));

    // A cor também chega aos poucos na da nova forma.
    const tone = toneBuffer.element(instanceIndex);
    tone.assign(mix(tone, toneTargetBuffer.element(instanceIndex), float(1).sub(exp(dt.mul(-3)))));
  })().compute(PARTICLE_COUNT);

  // Desenho: um quadradinho virado para a câmera por partícula, recortado num círculo suave.
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const posAttr = posBuffer.toAttribute();
  const toneAttr = toneBuffer.toAttribute();
  const seed = posAttr.w;
  material.positionNode = posAttr.xyz;
  material.scaleNode = u.size.mul(seed.mul(0.8).add(0.6)).mul(u.audio.mul(0.8).add(1));
  const hue = fract(mix(u.baseHue.add(toneAttr.x), toneAttr.x, toneAttr.w));
  const twinkle = sin(u.time.mul(seed.mul(3).add(1.5)).add(seed.mul(40))).mul(0.3).add(0.7);
  material.colorNode = vec4(hsl2rgb(hue, toneAttr.y, toneAttr.z).mul(twinkle).mul(u.audio.mul(0.6).add(1)), 1);
  material.opacityNode = softCircle().mul(u.opacity);

  particleSystem = new THREE.Sprite(material);
  particleSystem.count = PARTICLE_COUNT;
  particleSystem.frustumCulled = false;
  scene.add(particleSystem);
}

export async function initScene(container) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, windowAspect(), 0.1, 1000);
  lastCameraDistance = cameraDistance();
  camera.position.set(0, 5, lastCameraDistance);
  // A câmera entra na cena para o fundo AR (filho dela) acompanhar quando você gira a vista com o mouse.
  scene.add(camera);

  renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x050505);
  container.appendChild(renderer.domElement);
  await renderer.init();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  createParticles();
  initTrail(scene);

  renderPipeline = new THREE.RenderPipeline(renderer);
  sceneColor = pass(scene, camera).getTextureNode("output");
  bloomNode = bloom(sceneColor, settings.bloom, 0.45, 0.35);
  setBloomEnabled(true);

  window.addEventListener("resize", onWindowResize);
}

function setBloomEnabled(enabled) {
  bloomEnabled = enabled;
  renderPipeline.outputNode = enabled ? sceneColor.add(bloomNode) : sceneColor;
  renderPipeline.needsUpdate = true;
}

// Troca de forma: só muda o alvo de cada partícula; a mola (com um redemoinho) leva até lá.
export function morphTo(name, text) {
  const target = getShape(name, text);
  const targets = targetBuffer.value.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    targets[i * 4] = target.pos[i * 3];
    targets[i * 4 + 1] = target.pos[i * 3 + 1];
    targets[i * 4 + 2] = target.pos[i * 3 + 2];
  }
  targetBuffer.value.needsUpdate = true;
  toneTargetBuffer.value.array.set(target.tone);
  toneTargetBuffer.value.needsUpdate = true;
  pendingKick = MORPH_KICK;
}

// Deixa a figura de frente e a câmera no lugar inicial (usado ao mostrar o texto).
// Os ângulos são trazidos para -180°..180° antes, para ela virar pelo caminho mais curto
// em vez de desfazer todas as voltas que deu girando sozinha.
export function faceFront() {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  particleSystem.rotation.x = wrap(particleSystem.rotation.x);
  particleSystem.rotation.y = wrap(particleSystem.rotation.y);
  particleSystem.rotation.z = wrap(particleSystem.rotation.z);
  state.idleRotation = 0;
  state.targetRotationX = 0;
  state.targetRotationY = 0;
  state.targetRotationZ = 0;
  lastCameraDistance = cameraDistance();
  camera.position.set(0, 5, lastCameraDistance);
  controls.target.set(0, 0, 0);
  controls.update();
}

// Retorna false se ainda está no intervalo mínimo entre explosões.
export function triggerExplosion() {
  const now = clock.elapsedTime;
  if (now - state.lastExplodeTime < EXPLODE_COOLDOWN) return false;
  state.lastExplodeTime = now;
  pendingImpulse = EXPLOSION_IMPULSE;
  return true;
}

export function setHueUniform(hue) {
  u.baseHue.value = hue;
}

// ---------- Qualidade ----------

export function applyQualityLevel(index) {
  const level = QUALITY_LEVELS[index];
  particleSystem.count = level.count;
  // Menos partículas = cada uma um pouco mais forte, para a figura não ficar apagada.
  u.opacity.value = Math.min(0.2 * Math.sqrt(PARTICLE_COUNT / level.count), 0.6);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, level.pixelRatio));
  qualityBloom = level.bloom;
  if ((level.bloom > 0) !== bloomEnabled) setBloomEnabled(level.bloom > 0);
}

// ---------- Modo AR ----------

function fitARPlane() {
  if (!arPlane || !arVideo || !arVideo.videoWidth) return;
  const viewH = 2 * AR_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewW = viewH * camera.aspect;
  const videoAspect = arVideo.videoWidth / arVideo.videoHeight;
  // Cobre a tela inteira (corta as sobras), como "object-fit: cover".
  let w = viewW, h = viewW / videoAspect;
  if (h < viewH) { h = viewH; w = viewH * videoAspect; }
  // Largura negativa = imagem espelhada, como um espelho (igual à miniatura da webcam).
  arPlane.scale.set(-w, h, 1);
}

// Mostra a imagem da câmera escurecida atrás das partículas. Retorna false se a câmera não está ligada.
export function setARMode(on, video) {
  if (on && (!video || !video.videoWidth)) return false;
  if (on && !arPlane) {
    arVideo = video;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicNodeMaterial({
      map: texture,
      // Escurece a imagem para as partículas continuarem em destaque (e o bloom não pegar no vídeo).
      color: 0x555555,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    arPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    arPlane.position.set(0, 0, -AR_DISTANCE);
    arPlane.renderOrder = -1;
    camera.add(arPlane);
    fitARPlane();
  }
  if (arPlane) arPlane.visible = on;
  return true;
}

// ---------- Foto ----------

// Pede uma foto do próximo quadro (precisa ser lida logo depois de desenhar).
export function requestSnapshot(callback) {
  snapshotCallback = callback;
}

// ---------- Loop ----------

// Suavização independente da taxa de quadros (equivale a "rate" por frame a 60 fps).
function damp(rate, dt) {
  return 1 - Math.pow(1 - rate, dt * 60);
}

// Aproxima do alvo suavemente, mas sem passar de uma velocidade máxima (evita giros bruscos).
function approach(current, target, rate, maxSpeed, dt) {
  const step = (target - current) * damp(rate, dt);
  const limit = maxSpeed * dt;
  return current + THREE.MathUtils.clamp(step, -limit, limit);
}

// Avança a física e desenha um quadro. clock.getDelta() já foi chamado por quem chama.
export function renderFrame(dt) {
  const now = clock.elapsedTime;

  const idle = now - state.lastHandTime > IDLE_DELAY;
  // Ao ficar sem mão, a rotação automática continua do ângulo em que as mãos deixaram a figura.
  if (idle && !wasIdle && state.currentModel !== "text") state.idleRotation = state.targetRotationY;
  wasIdle = idle;
  if (idle) {
    // Sem mão: gira devagar e "respira" (o texto não gira, só respira).
    if (state.currentModel !== "text") state.idleRotation += dt * 0.2;
    state.targetRotationY = idleYaw();
    state.targetRotationX = 0;
  }
  state.breathAmount += ((idle ? 1 : 0) - state.breathAmount) * damp(0.03, dt);
  const breath = 1 + Math.sin(now * 1.6) * 0.025 * state.breathAmount;

  state.gestureScale += (state.targetGestureScale - state.gestureScale) * damp(0.12, dt);

  const rotationRate = THREE.MathUtils.lerp(0.14, 0.025, settings.smoothness);
  const maxRotationSpeed = THREE.MathUtils.lerp(5.0, 1.5, settings.smoothness);
  particleSystem.rotation.y = approach(particleSystem.rotation.y, state.targetRotationY, rotationRate, maxRotationSpeed, dt);
  particleSystem.rotation.x = approach(particleSystem.rotation.x, state.targetRotationX, rotationRate, maxRotationSpeed, dt);
  particleSystem.rotation.z = approach(particleSystem.rotation.z, state.targetRotationZ, rotationRate, maxRotationSpeed, dt);

  // Música: os graves "pulsam" o tamanho da figura; o volume geral aumenta brilho e tamanho dos pontos.
  const audioPulse = state.musicMode ? state.audioBass * 0.15 : 0;
  const audioLevel = state.musicMode ? state.audioLevel : 0;

  u.time.value = now;
  // Passo máximo de 1/30 s: depois de uma travada a física não "explode" sozinha.
  u.delta.value = Math.min(dt, 1 / 30);
  u.scale.value = BASE_MODEL_SCALE * state.gestureScale * breath * (1 + audioPulse);
  u.audio.value = audioLevel;
  u.impulse.value = pendingImpulse;
  u.kick.value = pendingKick;
  pendingImpulse = 0;
  pendingKick = 0;
  bloomNode.strength.value = settings.bloom * qualityBloom * (1 + audioLevel * 1.2);

  updateTrail(now, state.baseHue);

  controls.update();
  renderer.compute(computeUpdate);
  renderPipeline.render();

  if (snapshotCallback) {
    const callback = snapshotCallback;
    snapshotCallback = null;
    renderer.domElement.toBlob(callback, "image/png");
  }
}

function onWindowResize() {
  camera.aspect = windowAspect();
  camera.updateProjectionMatrix();
  camera.position.setLength(camera.position.length() * cameraDistance() / lastCameraDistance);
  lastCameraDistance = cameraDistance();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitARPlane();
}

// Converte um ponto da tela (-1 a 1) para o mundo 3D, no plano que passa pelo centro da figura
// de frente para a câmera. Usado pelo modo pintar.
const paintRaycaster = new THREE.Raycaster();
const paintPlane = new THREE.Plane();
const tmpNormal = new THREE.Vector3();
export function screenToWorld(x, y, target) {
  paintRaycaster.setFromCamera({ x, y }, camera);
  camera.getWorldDirection(tmpNormal);
  paintPlane.set(tmpNormal, 0);
  return paintRaycaster.ray.intersectPlane(paintPlane, target);
}
