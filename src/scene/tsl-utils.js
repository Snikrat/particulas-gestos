// Funções de shader (TSL) usadas pelas partículas e pelo rastro.
import { Fn, vec3, float, uv, clamp, abs, mod, smoothstep } from "three/tsl";

// HSL -> RGB dentro do shader.
export const hsl2rgb = Fn(([h, s, l]) => {
  const rgb = clamp(abs(mod(h.mul(6).add(vec3(0, 4, 2)), 6).sub(3)).sub(1), 0, 1);
  return rgb.sub(0.5).mul(s.mul(float(1).sub(abs(l.mul(2).sub(1))))).add(l);
});

// Recorta o quadradinho do sprite num círculo de borda suave (1 no centro, 0 na borda).
export function softCircle() {
  const edge = float(1).sub(smoothstep(0, 0.5, uv().sub(0.5).length()));
  return edge.mul(edge);
}
