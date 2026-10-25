# Partículas 3D com Gestos de Mão

Até 300 mil partículas em 3D que você controla com a mão pela webcam (Three.js + MediaPipe).

Renderiza com **WebGPU**: cada partícula tem física de verdade (posição e velocidade) calculada num compute shader na placa de vídeo, puxada por uma mola até o seu lugar na forma. Em navegadores sem WebGPU, o mesmo código roda em WebGL 2, começando numa qualidade mais leve. O console mostra qual está em uso.

Baseado no demo [particle-interaction](https://github.com/wonderstone/particle-interaction) de wonderstone, de onde vieram a ideia e as formas da árvore, de Saturno e do coração.

## Como rodar

Precisa do [Node.js](https://nodejs.org/) 18 ou mais novo.

```bash
npm install
npm run dev
```

Abre em `http://127.0.0.1:5173`. Permita a câmera quando o navegador pedir.

Na primeira vez, o `npm run dev` copia os arquivos do detector de mãos para `public/mediapipe/` e baixa o modelo de mão (~7,5 MB). Depois disso o app funciona sem internet.

### Versão final

```bash
npm run build
```

Gera a pasta `dist/`, que pode ser publicada em qualquer hospedagem estática (GitHub Pages, Netlify...). Para testar localmente: `npm run preview`.

A câmera só funciona em `localhost`/`127.0.0.1` ou em sites com HTTPS.

## Gestos

| Gesto | Efeito |
| --- | --- |
| Punho empurrado para a câmera | Aproxima um nível (Visão ampla → Visão completa → Perto → Muito perto) |
| Mão aberta puxada para trás | Afasta um nível |
| Duas mãos: a esquerda para os lados | Gira a figura para os lados |
| Duas mãos: a direita para cima/baixo | Gira a figura para cima/baixo |
| Sinal de 2 dedos (segure até o anel encher) | Centraliza a figura de frente, na visão completa |
| L com polegar e indicador (segure até o anel encher) | Troca para o texto, de frente e na visão completa |
| Empurrar a mão aberta rápido para a câmera | Explode as partículas |
| Mexer as duas mãos rápido ao mesmo tempo | Explode as partículas |
| Modo pintar: apontar só com o indicador | Desenha no ar |

Na primeira vez que abre, um tutorial ensina cada gesto na prática.

## Modos

| Botão | Tecla | O que faz |
| --- | --- | --- |
| Pintar | `T` | O indicador deixa um rastro de luz (`L` apaga o desenho) |
| Música | `M` | Partículas pulsam com o som do microfone |
| AR | `A` | Imagem da câmera ao fundo, escurecida |
| Imagem | `I` | Envia uma foto ou logo e ela vira partículas (forma 8) |
| Foto | `O` | Salva um PNG da tela |
| Gravar | `G` | Grava um vídeo WebM (até 60 s) |

Outras teclas: `1`–`8` formas · `E` explodir · `R` resetar zoom e giro · `C` calibrar · `P` pontos da mão · `V` expandir câmera · `H` esconder interface · `F` tela cheia.

Em **Ajustes**: qualidade (automática pelo FPS ou fixa), efeitos sonoros, sensibilidades, suavidade e brilho. Tudo fica salvo no navegador.

## Estrutura

```
index.html              Estrutura da página (painel, botões, webcam)
src/
  main.js               Ponto de entrada: monta tudo e roda o loop
  style.css             Visual da interface
  config.js             Constantes (limites dos gestos, nº de partículas...)
  settings.js           Ajustes do usuário, salvos no navegador
  state.js              Estado compartilhado (rotação, zoom, cor...)
  actions.js            Ações usadas por gestos, painel e teclado
  gestures.js           Interpreta uma ou duas mãos em gestos
  capture.js            Foto e gravação de vídeo
  scene/
    particles.js        Cena WebGPU, física das partículas (compute shader), bloom, fundo AR
    shapes.js           Geração das formas (inclui texto e imagem enviada)
    trail.js            Rastro do modo pintar
    quality.js          Qualidade automática pelo FPS
    tsl-utils.js        Funções de shader compartilhadas (cor, círculo suave)
  audio/
    context.js          AudioContext compartilhado
    music.js            Análise do microfone (modo música)
    sfx.js              Efeitos sonoros sintetizados
  hand/
    tracker.js          Câmera + detector de mãos do MediaPipe
    filters.js          Filtro One Euro (suaviza a tremedeira)
    geometry.js         Medidas da mão (dobra dos dedos, palma...)
    calibration.js      Calibração de mão aberta / punho
    skeleton.js         Desenho dos pontos da mão
  ui/
    panel.js            Painel, sliders e atalhos
    feedback.js         Status, avisos, cursor e anel de progresso
    tutorial.js         Tutorial interativo da primeira vez
scripts/
  setup-assets.mjs      Copia o MediaPipe e baixa o modelo de mão
```
