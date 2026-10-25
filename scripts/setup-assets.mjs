// Deixa o detector de mãos funcionando sem internet:
// copia os arquivos WebAssembly do MediaPipe de node_modules para public/
// e baixa o modelo de mão uma única vez.
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = join(root, "public", "mediapipe", "wasm");
const modelDest = join(root, "public", "mediapipe", "hand_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(wasmDest, { recursive: true });
await cp(wasmSrc, wasmDest, { recursive: true });

if (!(await exists(modelDest))) {
  console.log("Baixando o modelo de mão do MediaPipe (~7,5 MB)...");
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    console.warn(`Não consegui baixar o modelo (${response.status}). O app vai tentar baixar online ao abrir.`);
  } else {
    await writeFile(modelDest, Buffer.from(await response.arrayBuffer()));
    console.log("Modelo salvo em public/mediapipe/hand_landmarker.task");
  }
}
