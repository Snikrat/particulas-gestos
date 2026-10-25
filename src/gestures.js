// Interpreta as mãos detectadas em gestos.
// Uma mão: punho empurrado para a câmera aproxima, mão aberta puxada para trás afasta (zoom em níveis),
//          2 dedos (centralizar), L (texto, o único gesto que troca de forma), empurrão rápido da mão aberta
//          (explosão) e, no modo pintar, desenhar com o indicador. Uma mão sozinha não gira a figura.
// Duas mãos: cada uma comanda um giro. A esquerda, para os lados, gira para os lados;
//            a direita, para cima/baixo, gira para cima/baixo.
import * as THREE from "three";
import {
  SHAPE_LABELS, ZOOM_LEVELS,
  FIST_STABLE_FRAMES, COUNT_STABLE_FRAMES, SHAPE_SWITCH_COOLDOWN,
  PUSH_GROWTH, PUSH_WINDOW, ZOOM_OUT_BLOCK_AFTER_EXPLOSION,
  THUMB_FOLDED_RATIO, L_MIN_ANGLE, HAND_LOST_GRACE, TWO_HAND_GRACE,
  TWO_HAND_EXPLODE_SPEED, TWO_HAND_EXPLODE_FRAMES
} from "./config.js";
import { settings } from "./settings.js";
import { state, clock } from "./state.js";
import { smoothLandmarks, resetLandmarkFilters } from "./hand/filters.js";
import { dist3, fingerBends, palmSizeInImage, imageToScreen } from "./hand/geometry.js";
import { drawHands, clearHand } from "./hand/skeleton.js";
import { thresholds, isCalibrating, updateCalibration } from "./hand/calibration.js";
import { screenToWorld, faceFront } from "./scene/particles.js";
import { paintAt, liftPen } from "./scene/trail.js";
import { changeShape, triggerExplosion, resetZoom } from "./actions.js";
import { setStatus, flashStatus, showHint, moveCursor, hideCursor, setCursorProgress } from "./ui/feedback.js";
import { notifyTutorial } from "./ui/tutorial.js";

let isFistState = false;
let fistCandidateFrames = 0;

// Zoom em degraus. Punho: guarda o menor tamanho da palma desde o último degrau; crescer além
// do limiar (mão indo para a câmera) sobe um nível. Mão aberta: guarda o maior tamanho; encolher
// além do limiar (mão indo para trás) desce um nível. Depois de cada degrau a referência recomeça,
// então dá para subir ou descer vários níveis repetindo o movimento.
let fistMinPalm = 0;
let openMaxPalm = 0;
let zoomOutBlockedUntil = -10;

// O que o gesto segurado atual pede (uma forma, ou CENTER para centralizar) e há quantos quadros.
const CENTER = "center";
let shapeCandidate = null;
let shapeFrames = 0;
let centerDone = false;
let lastShapeSwitch = -10;

let palmHistory = [];
let lastHandCount = 0;

// Duas mãos: posição de cada mão e giro da figura no momento em que a segunda mão apareceu.
let twoHandActive = false;
let lastTwoHandTime = -10;
let twoHandAnchor = null;
// Para a explosão com as duas mãos: posição de cada mão no quadro anterior, quantos quadros seguidos
// as duas estão rápidas, e o giro dos últimos instantes (para desfazer o giro do movimento brusco).
let prevTwoHand = null;
let fastFrames = 0;
let rotationHistory = [];
// Na explosão, o giro volta ao valor de tanto tempo atrás (s): antes de o movimento rápido começar,
// já que o filtro de suavização faz o começo dele parecer lento por alguns quadros.
const ROTATION_UNDO_SECONDS = 0.4;
// Depois da explosão o giro fica parado por esse tempo (s): o resto do movimento brusco não conta.
const ROTATION_FREEZE_AFTER_EXPLOSION = 0.5;
let rotationFrozenUntil = -10;

const paintPoint = new THREE.Vector3();

function resetGestureState() {
  resetLandmarkFilters();
  isFistState = false;
  fistCandidateFrames = 0;
  fistMinPalm = 0;
  openMaxPalm = 0;
  shapeCandidate = null;
  shapeFrames = 0;
  palmHistory = [];
  liftPen();
}

// Quantos dedos estão levantados em sequência (1 = indicador, 2 = indicador + médio, ...),
// com o polegar dobrado. Retorna 0 se a mão não estiver nessa pose.
function fingerCount(bends, world) {
  const palmLen = dist3(world[0], world[9]) || 1e-6;
  const thumbFolded = dist3(world[4], world[9]) / palmLen < THUMB_FOLDED_RATIO;
  if (!thumbFolded) return 0;
  const extended = bends.map((b) => b < thresholds.fingerExt);
  const curled = bends.map((b) => b > thresholds.fingerCurl);
  for (let n = 1; n <= 4; n++) {
    let ok = true;
    for (let f = 0; f < 4; f++) {
      if (f < n ? !extended[f] : !curled[f]) { ok = false; break; }
    }
    if (ok) return n;
  }
  return 0;
}

// Sobe (+1) ou desce (-1) um nível de zoom, se houver para onde ir.
function stepZoom(delta) {
  const level = THREE.MathUtils.clamp(state.zoomLevel + delta, 0, ZOOM_LEVELS.length - 1);
  if (level === state.zoomLevel) return;
  state.zoomLevel = level;
  state.targetGestureScale = ZOOM_LEVELS[level].scale;
  showHint(ZOOM_LEVELS[level].name);
  notifyTutorial("zoom");
}

// Quanto a palma precisa crescer (ou encolher, no inverso) na imagem para contar um degrau.
// A "Sensibilidade do zoom" em Ajustes muda esse limiar: 2.0 = 20%.
function zoomStepRatio() {
  return 1 + 0.4 / settings.zoomSensitivity;
}

function zoomLabel() {
  return ZOOM_LEVELS[state.zoomLevel].name;
}

// Gesto de "L": polegar e indicador esticados formando um ângulo, os outros três dedos dobrados.
function isLShape(bends, world) {
  if (!isPointing(bends)) return false;
  const palmLen = dist3(world[0], world[9]) || 1e-6;
  if (dist3(world[4], world[9]) / palmLen < THUMB_FOLDED_RATIO) return false;
  // Ângulo entre o polegar (base -> ponta) e o indicador (base -> ponta): num L fica perto de 90°.
  const t = { x: world[4].x - world[2].x, y: world[4].y - world[2].y, z: world[4].z - world[2].z };
  const i = { x: world[8].x - world[5].x, y: world[8].y - world[5].y, z: world[8].z - world[5].z };
  const cos = (t.x * i.x + t.y * i.y + t.z * i.z) / ((Math.hypot(t.x, t.y, t.z) * Math.hypot(i.x, i.y, i.z)) || 1e-6);
  return cos < Math.cos(THREE.MathUtils.degToRad(L_MIN_ANGLE));
}

// Só o indicador esticado (o polegar pode estar como quiser): é a "caneta" do modo pintar.
function isPointing(bends) {
  return bends[0] < thresholds.fingerExt && bends.slice(1).every((b) => b > thresholds.fingerCurl);
}

// Centro da palma em coordenadas de tela (-1 a 1, sem limitar nas bordas).
function palmCenterOnScreen(hand) {
  const ids = [0, 5, 9, 17];
  const p = {
    x: ids.reduce((s, i) => s + hand[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + hand[i].y, 0) / ids.length
  };
  return imageToScreen(p, false);
}

// Mostra o texto da calibração (ou a mensagem final dela). Retorna true se a calibração ainda está rodando.
function handleCalibration(meanBend, now) {
  if (!isCalibrating()) return false;
  const { text, message } = updateCalibration(meanBend, now);
  if (message) {
    flashStatus(message);
    return false;
  }
  setStatus(meanBend === null ? text : `${text}<br>Dobra: ${Math.round(meanBend)}°`, meanBend !== null);
  return true;
}

function handleNoHand(now) {
  // Perda breve: mantém tudo como está para não dar tranco.
  if (now - state.lastHandTime < HAND_LOST_GRACE) return;
  hideCursor();
  twoHandActive = false;
  lastHandCount = 0;
  resetGestureState();
  clearHand();
  if (!handleCalibration(null, now)) {
    setStatus("Nenhuma mão detectada. Coloque a mão na imagem da câmera (canto inferior direito).", false);
  }
}

// Cada mão comanda um giro: a esquerda, andando para os lados, gira a figura para os lados;
// a direita, andando para cima ou para baixo, gira para cima ou para baixo.
function processTwoHands(hands, now) {
  lastTwoHandTime = now;
  // As mãos vêm ordenadas pelo x da imagem, que é espelhada: a primeira aparece à direita na tela
  // (a sua mão direita) e a segunda à esquerda (a sua mão esquerda).
  const right = palmCenterOnScreen(hands[0]);
  const left = palmCenterOnScreen(hands[1]);

  if (!twoHandActive) {
    twoHandActive = true;
    isFistState = false;
    liftPen();
    // Giro relativo: parte do ângulo atual da figura, sem pular para a posição das mãos.
    twoHandAnchor = {
      leftX: left.x,
      rightY: right.y,
      rotX: state.targetRotationX,
      rotY: state.targetRotationY
    };
    prevTwoHand = null;
    fastFrames = 0;
    rotationHistory = [];
  }

  // Velocidade de cada mão desde o quadro anterior (larguras de tela por segundo).
  let speedLeft = 0, speedRight = 0;
  if (prevTwoHand && now > prevTwoHand.t) {
    const dt = now - prevTwoHand.t;
    speedLeft = Math.hypot(left.x - prevTwoHand.left.x, left.y - prevTwoHand.left.y) / dt;
    speedRight = Math.hypot(right.x - prevTwoHand.right.x, right.y - prevTwoHand.right.y) / dt;
  }
  prevTwoHand = { left, right, t: now };
  const fast = speedLeft > TWO_HAND_EXPLODE_SPEED && speedRight > TWO_HAND_EXPLODE_SPEED;
  fastFrames = fast ? fastFrames + 1 : 0;
  // Guarda o giro de cada quadro (antes de aplicar o deste) para poder voltar no tempo.
  rotationHistory.push({ t: now, x: state.targetRotationX, y: state.targetRotationY });
  while (rotationHistory.length > 1 && now - rotationHistory[1].t > ROTATION_UNDO_SECONDS) rotationHistory.shift();

  if (state.currentModel === "text") {
    // O texto não gira: fica de frente e reto para ser lido.
    state.targetRotationX = 0;
    state.targetRotationY = 0;
    state.targetRotationZ = 0;
  } else if (now < rotationFrozenUntil) {
    // Logo depois da explosão: segura o giro e vai acompanhando onde as mãos estão,
    // para quando destravar a figura continuar dali sem pular.
    twoHandAnchor = { leftX: left.x, rightY: right.y, rotX: state.targetRotationX, rotY: state.targetRotationY };
  } else {
    const prevY = state.targetRotationY, prevX = state.targetRotationX;
    // Mão esquerda pela largura inteira da tela = ~160° de giro lateral (sensibilidade 1.0).
    state.targetRotationY = twoHandAnchor.rotY + (left.x - twoHandAnchor.leftX) * Math.PI * 0.9 * settings.rotationSensitivity;
    // Mão direita pela altura inteira da tela = ~110° de giro vertical. Subir a mão inclina a frente para cima.
    state.targetRotationX = twoHandAnchor.rotX - (right.y - twoHandAnchor.rightY) * Math.PI * 0.6 * settings.rotationSensitivity;
    notifyTutorial("two-hands", Math.abs(state.targetRotationY - prevY) + Math.abs(state.targetRotationX - prevX) + 1 / 60);
  }

  // Movimento rápido das duas mãos ao mesmo tempo => explosão. O giro volta para onde estava antes
  // do movimento brusco, e as mãos passam a valer a partir da posição nova.
  if (fastFrames >= TWO_HAND_EXPLODE_FRAMES) {
    fastFrames = 0;
    if (triggerExplosion()) {
      notifyTutorial("explode");
      showHint("Explosão!");
    }
    if (rotationHistory.length && state.currentModel !== "text") {
      state.targetRotationX = rotationHistory[0].x;
      state.targetRotationY = rotationHistory[0].y;
    }
    rotationHistory = [];
    rotationFrozenUntil = now + ROTATION_FREEZE_AFTER_EXPLOSION;
    twoHandAnchor = {
      leftX: left.x,
      rightY: right.y,
      rotX: state.targetRotationX,
      rotY: state.targetRotationY
    };
  }

  hideCursor();
  const deg = (r) => Math.round(THREE.MathUtils.radToDeg(r));
  setStatus(
    `Gesto: duas mãos · Lados: ${deg(state.targetRotationY)}° · Cima/baixo: ${deg(state.targetRotationX)}°<br>` +
    "Mão esquerda para os lados gira para os lados · mão direita para cima/baixo gira para cima/baixo",
    true
  );
}

function processOneHand(hand, world, now) {
  const bends = fingerBends(world);
  const meanBend = bends.reduce((a, b) => a + b, 0) / 4;
  const palmSize = palmSizeInImage(hand, state.cameraAspect);
  const tip = imageToScreen(hand[8]);
  const cursorX = (tip.x + 1) * 0.5 * window.innerWidth;
  const cursorY = (1 - tip.y) * 0.5 * window.innerHeight;

  if (handleCalibration(meanBend, now)) {
    moveCursor(cursorX, cursorY, { fist: false });
    setCursorProgress(0);
    return;
  }

  // Punho, com histerese e estabilidade. O indicador também precisa estar dobrado:
  // só a média não basta, porque apontar (3 dedos dobrados) já passa do limite.
  const rawFist = isFistState
    ? meanBend > thresholds.fistOpen && bends[0] > thresholds.fingerExt
    : meanBend > thresholds.fistClose && bends[0] > thresholds.fingerCurl;
  if (rawFist !== isFistState) {
    if (++fistCandidateFrames >= FIST_STABLE_FRAMES) {
      isFistState = rawFist;
      fistCandidateFrames = 0;
      if (isFistState) fistMinPalm = palmSize;
    }
  } else {
    fistCandidateFrames = 0;
  }
  const allExtended = bends.every((b) => b < thresholds.fingerExt);

  // Modo pintar: apontar com o indicador desenha.
  const painting = state.paintMode && !isFistState && isPointing(bends);
  if (painting) {
    if (screenToWorld(tip.x, tip.y, paintPoint)) paintAt(paintPoint, now);
  } else {
    liftPen();
  }

  moveCursor(cursorX, cursorY, { fist: isFistState, paint: painting });

  let gestureName = allExtended ? "mão aberta" : "mão";
  let hintText = state.paintMode
    ? "Modo pintar: aponte com o indicador para desenhar"
    : "Punho para a câmera aproxima · mão aberta para trás afasta · duas mãos giram";

  // Zoom em degraus: punho indo para a câmera sobe um nível; mão aberta indo para trás desce.
  const stepRatio = zoomStepRatio();
  if (isFistState) {
    gestureName = "punho fechado";
    hintText = "Empurre o punho para a câmera para aproximar";
    fistMinPalm = Math.min(fistMinPalm || palmSize, palmSize);
    if (palmSize > fistMinPalm * stepRatio) {
      stepZoom(+1);
      fistMinPalm = palmSize;
    }
  } else {
    fistMinPalm = 0;
  }
  if (allExtended && !isFistState) {
    openMaxPalm = Math.max(openMaxPalm || palmSize, palmSize);
    // Logo depois de uma explosão a mão costuma voltar para trás: isso não deve afastar o zoom.
    if (now < zoomOutBlockedUntil) {
      openMaxPalm = palmSize;
    } else if (palmSize < openMaxPalm / stepRatio) {
      stepZoom(-1);
      openMaxPalm = palmSize;
    }
  } else {
    openMaxPalm = 0;
  }

  if (painting) {
    gestureName = "pintando";
    hintText = "Abra a mão para parar de desenhar";
  }

  // Gestos segurados até o anel encher: 2 dedos centralizam a figura (de frente e na visão completa);
  // L troca para o texto. É o único gesto que troca de forma; as outras formas ficam no painel e no teclado.
  // Desligados no modo pintar (apontar é a caneta).
  let target = null;
  if (!isFistState && !state.paintMode) {
    if (fingerCount(bends, world) === 2) {
      target = CENTER;
      gestureName = "2 dedos";
    } else if (isLShape(bends, world)) {
      target = "text";
      gestureName = "L";
    }
  }
  if (target && target === shapeCandidate) {
    shapeFrames++;
  } else {
    shapeCandidate = target;
    shapeFrames = target ? 1 : 0;
    centerDone = false;
  }
  let ringProgress = 0;
  let ringLabel = "";
  // O L com o texto já na tela também recentraliza (volta de frente e na visão completa).
  const recenter = target === CENTER || (target === "text" && state.currentModel === "text");
  if (recenter) {
    // Centraliza uma vez por gesto: para repetir, baixe a mão ou mude o sinal e faça de novo.
    if (centerDone) {
      hintText = "Centralizado";
    } else {
      hintText = "Segure para centralizar...";
      ringProgress = shapeFrames / COUNT_STABLE_FRAMES;
      ringLabel = target === CENTER ? "Centralizar" : "Visão completa";
      if (shapeFrames >= COUNT_STABLE_FRAMES) {
        faceFront();
        resetZoom();
        centerDone = true;
        showHint("Centralizado");
        ringProgress = 0;
      }
    }
  } else if (target) {
    if (target === state.currentModel) {
      hintText = `Forma atual: ${SHAPE_LABELS[target]}`;
    } else {
      hintText = `Segure para trocar para ${SHAPE_LABELS[target]}...`;
      ringProgress = shapeFrames / COUNT_STABLE_FRAMES;
      ringLabel = SHAPE_LABELS[target];
      if (shapeFrames >= COUNT_STABLE_FRAMES && now - lastShapeSwitch > SHAPE_SWITCH_COOLDOWN) {
        changeShape(target);
        // O texto pelo L já aparece inteiro, na visão completa.
        if (target === "text") {
          resetZoom();
          centerDone = true;
        }
        lastShapeSwitch = now;
        showHint(SHAPE_LABELS[target]);
        notifyTutorial("shape");
        ringProgress = 0;
      }
    }
  }
  setCursorProgress(ringProgress, ringLabel);

  // Empurrão rápido com a mão aberta em direção à câmera => explosão.
  palmHistory.push({ t: now, size: palmSize });
  while (palmHistory.length && now - palmHistory[0].t > PUSH_WINDOW) palmHistory.shift();
  if (allExtended && !isFistState && palmHistory.length > 3) {
    const minSize = Math.min(...palmHistory.map((h) => h.size));
    if (palmSize / minSize > PUSH_GROWTH) {
      if (triggerExplosion()) notifyTutorial("explode");
      palmHistory = [];
      zoomOutBlockedUntil = now + ZOOM_OUT_BLOCK_AFTER_EXPLOSION;
    }
  }

  setStatus(
    `Gesto: ${gestureName} · Zoom: ${zoomLabel()} · Dobra: ${Math.round(meanBend)}°<br>${hintText}`,
    true
  );
}

// Recebe { landmarks, worldLandmarks } do detector (uma lista por mão).
export function processHand(results) {
  const now = clock.elapsedTime;
  const raw = results.landmarks || [];

  if (raw.length === 0) {
    handleNoHand(now);
    return;
  }

  state.lastHandTime = now;
  notifyTutorial("hand");

  // Ordena pela posição na imagem, para cada mão manter o mesmo filtro entre quadros.
  const order = raw.map((_, i) => i).sort((a, b) => raw[a][0].x - raw[b][0].x);
  if (order.length !== lastHandCount) {
    resetLandmarkFilters();
    lastHandCount = order.length;
  }
  const t = performance.now() / 1000;
  const hands = order.map((i, slot) => smoothLandmarks(raw[i], t, slot));
  drawHands(hands);

  if (hands.length >= 2 && !isCalibrating()) {
    processTwoHands(hands, now);
    return;
  }

  // Uma das mãos sumiu por um instante: continua no modo de duas mãos sem mexer em nada.
  if (twoHandActive && now - lastTwoHandTime < TWO_HAND_GRACE) return;
  twoHandActive = false;

  // Pontos 3D em metros (independentes da distância da câmera); se faltarem, usa os da imagem.
  const world = (results.worldLandmarks && results.worldLandmarks[order[0]]) || hands[0];
  processOneHand(hands[0], world, now);
}
