// Constantes do app. Valores que o usuário ajusta pelo painel ficam em settings.js.

// Arquivos do detector de mãos, servidos localmente (copiados por scripts/setup-assets.mjs).
export const MEDIAPIPE_WASM = `${import.meta.env.BASE_URL}mediapipe/wasm`;
export const HAND_MODEL = `${import.meta.env.BASE_URL}mediapipe/hand_landmarker.task`;
// Se o modelo local não existir (setup não rodou), baixa direto do Google.
export const HAND_MODEL_FALLBACK =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Máximo de partículas. A física de todas roda na placa de vídeo (compute shader, WebGPU);
// a qualidade escolhe quantas são desenhadas.
export const PARTICLE_COUNT = 300000;

export const SHAPES = ["tree", "saturn", "heart", "galaxy", "sphere", "dna", "text", "image"];
export const SHAPE_LABELS = {
  tree: "Árvore de Natal",
  saturn: "Saturno",
  heart: "Coração",
  galaxy: "Galáxia",
  sphere: "Esfera",
  dna: "DNA",
  text: "Texto",
  image: "Imagem"
};

// Níveis de qualidade: o automático desce de nível quando o FPS cai e sobe quando sobra folga.
// pixelRatio é o máximo usado (nunca passa da resolução real da tela).
export const QUALITY_LEVELS = [
  { name: "Alta", count: 300000, pixelRatio: 2, bloom: 1 },
  { name: "Média", count: 160000, pixelRatio: 1.5, bloom: 1 },
  { name: "Baixa", count: 80000, pixelRatio: 1, bloom: 0.6 },
  { name: "Mínima", count: 40000, pixelRatio: 1, bloom: 0 }
];
// Sem WebGPU (plano B em WebGL 2) a qualidade automática já começa neste nível.
export const WEBGL_FALLBACK_QUALITY = 2;

// Física das partículas: mola puxando cada uma para o seu lugar na forma.
// Rigidez maior = chegam mais rápido; arrasto maior = balançam menos.
export const SPRING_STIFFNESS = 6;
export const SPRING_DRAG = 3.5;
// Velocidade (unidades/s) do empurrão da explosão e do redemoinho ao trocar de forma.
export const EXPLOSION_IMPULSE = 85;
export const MORPH_KICK = 25;
export const QUALITY_DOWN_FPS = 40;
export const QUALITY_UP_FPS = 57;

// Duas mãos: se uma some por menos que isso, continua no modo de duas mãos (evita trancos).
export const TWO_HAND_GRACE = 0.25;
// Explosão com as duas mãos: velocidade mínima de cada uma (em larguras de tela por segundo,
// a tela inteira = 2) e por quantos quadros seguidos as duas precisam estar rápidas.
export const TWO_HAND_EXPLODE_SPEED = 3.0;
export const TWO_HAND_EXPLODE_FRAMES = 2;

// Modo pintar: quantos pontos de tinta existem ao mesmo tempo e quanto tempo cada um dura (s).
export const PAINT_PARTICLES = 12000;
export const PAINT_LIFE = 6;

// Imagem enviada: maior lado depois de reduzida (pixels). Menor = mais rápido e cabe no armazenamento.
export const IMAGE_MAX_SIZE = 220;
export const IMAGE_KEY = "particulas-imagem";

// Gravação de vídeo para sozinha depois disso (s).
export const MAX_RECORDING_SECONDS = 60;

// Com scale=1, a figura ocupa cerca de 80% da tela.
export const BASE_MODEL_SCALE = 1.75;
// Zoom em níveis fixos (punho ou duas mãos): aproximar a mão sobe um nível, afastar desce.
export const ZOOM_LEVELS = [
  { name: "Visão ampla", scale: 0.6 },
  { name: "Visão completa", scale: 1.0 },
  { name: "Perto", scale: 1.6 },
  { name: "Muito perto", scale: 2.4 }
];
// Nível em que o app abre e para onde o sinal de 2 e o L voltam.
export const DEFAULT_ZOOM_LEVEL = 1;
// Depois de uma explosão (empurrão da mão aberta), a mão costuma voltar para trás:
// durante esse tempo (s) o "puxar para trás" não afasta o zoom.
export const ZOOM_OUT_BLOCK_AFTER_EXPLOSION = 1.5;

// Quantos frames seguidos o novo estado do punho precisa aparecer antes de valer.
export const FIST_STABLE_FRAMES = 4;
// Quantos frames segurando a mesma contagem de dedos antes de trocar a forma.
export const COUNT_STABLE_FRAMES = 12;
export const SHAPE_SWITCH_COOLDOWN = 1.2;

// Explosão: palma aberta crescendo esse tanto na imagem dentro da janela de tempo.
export const PUSH_GROWTH = 1.35;
export const PUSH_WINDOW = 0.35;
export const EXPLODE_COOLDOWN = 1.5;

// Polegar dobrado: ponta do polegar perto da base do dedo médio (relativo ao tamanho da palma).
export const THUMB_FOLDED_RATIO = 0.7;

// Gesto de L: ângulo mínimo entre o polegar e o indicador (um L perfeito tem 90°).
export const L_MIN_ANGLE = 50;

// Se a detecção perder a mão por pouco tempo, mantém o estado em vez de resetar tudo (evita trancos).
export const HAND_LOST_GRACE = 0.3;

// Largura da palma (base do indicador até base do mindinho) / comprimento (pulso até base do médio).
export const PALM_WIDTH_RATIO = 0.8;

// Segundos sem mão até a figura começar a girar e "respirar" sozinha.
export const IDLE_DELAY = 1.5;

// Dobra média (graus) com a mão aberta e com o punho fechado. A calibração substitui esses valores.
export const DEFAULT_CALIBRATION = { open: 15, fist: 170 };
export const CALIBRATION_KEY = "particulas-calibracao";
