// Configurações do usuário, salvas automaticamente no navegador (localStorage).

const SETTINGS_KEY = "particulas-ajustes";

export const DEFAULT_SETTINGS = {
  shape: "tree",
  color: "#00ffcc",
  text: "OLÁ",
  showSkeleton: true,
  cameraExpanded: false,
  // Multiplica o quanto a figura gira para cada centímetro que a mão anda.
  rotationSensitivity: 1.0,
  // 0 = segue a mão na hora (pode tremer); 1 = bem suave (com mais atraso).
  smoothness: 0.5,
  // Palma 1.5x maior na imagem => figura 1.5^zoomSensitivity vezes maior.
  zoomSensitivity: 2.0,
  bloom: 0.7,
  // "auto" ou o índice de QUALITY_LEVELS fixado pelo usuário ("0" = Alta ... "3" = Mínima).
  quality: "auto",
  sfx: true,
  arMode: false,
  tutorialDone: false
};

// Os que o botão "Restaurar padrões" volta ao valor inicial.
export const SLIDER_KEYS = ["rotationSensitivity", "smoothness", "zoomSensitivity", "bloom"];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings = loadSettings();

let saveTimer = null;
export function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }, 300);
}
