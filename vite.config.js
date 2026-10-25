import { defineConfig } from "vite";

export default defineConfig({
  // Caminhos relativos: a pasta dist/ funciona em qualquer servidor estático (ou empacotada com Tauri).
  base: "./",
  resolve: {
    // Tudo que importa "three" (inclusive os addons, como o OrbitControls) usa o build WebGPU,
    // que também cai para WebGL 2 sozinho quando o navegador não tem WebGPU.
    alias: [{ find: /^three$/, replacement: "three/webgpu" }]
  },
  server: {
    // A câmera só funciona em localhost/127.0.0.1 (ou HTTPS).
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: true
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500
  }
});
