// Small inline-SVG diagrams for glossary entries, drawn for PaperPeek (CC BY 4.0).
// Colours come from classes styled inside the popup, so they follow its theme.

import { gelu, softmax } from '../../core/demo-math';

const W = 340;

function svg(height: number, label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" role="img" aria-label="${label}">${body}</svg>`;
}

function box(x: number, y: number, w: number, label: string): string {
  return (
    `<rect class="d-box" x="${x}" y="${y}" width="${w}" height="24" rx="6"/>` +
    `<text class="d-text" x="${x + w / 2}" y="${y + 16}" text-anchor="middle">${label}</text>`
  );
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="d-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

/** Rightward, upward or downward arrow ending at (x2, y2). */
function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const back = y2 < y1 ? 6 : -6;
  const head =
    y1 === y2
      ? `${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`
      : `${x2},${y2} ${x2 - 4},${y2 + back} ${x2 + 4},${y2 + back}`;
  return line(x1, y1, x2, y2) + `<polygon class="d-head" points="${head}"/>`;
}

function text(x: number, y: number, label: string, anchor = 'middle'): string {
  return `<text class="d-text" x="${x}" y="${y}" text-anchor="${anchor}">${label}</text>`;
}

function curve(fn: (x: number) => number, x0: number, x1: number, box: [number, number, number, number], cls = 'd-curve'): string {
  const [left, top, width, height] = box;
  const points: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60;
    points.push(`${(left + (width * i) / 60).toFixed(1)},${(top + height * (1 - fn(x))).toFixed(1)}`);
  }
  return `<polyline class="${cls}" points="${points.join(' ')}"/>`;
}

function bars(values: number[], left: number, base: number, scale: number): string {
  return values
    .map((v, i) => {
      const h = Math.abs(v) * scale;
      const y = v >= 0 ? base - h : base;
      return `<rect class="d-bar" x="${left + i * 22}" y="${y.toFixed(1)}" width="16" height="${h.toFixed(1)}" rx="2"/>`;
    })
    .join('');
}

const scores = [2, 1, 0.1, -1];
const probs = softmax(scores);
// Activation plot: x ∈ [−3, 3], y ∈ [−1, 3] mapped to 0..1.
const toUnit = (y: number): number => (y + 1) / 4;

const dropoutNodes = (x: number, dropped: number[] = []): string =>
  [0, 1, 2, 3]
    .map((i) => `<circle class="${dropped.includes(i) ? 'd-off' : 'd-node'}" cx="${x}" cy="${16 + i * 22}" r="7"/>`)
    .join('');
const dropoutEdges = (from: number, to: number, dropped: number[]): string =>
  [0, 1, 2, 3]
    .flatMap((i) => [0, 1, 2, 3].filter((j) => !dropped.includes(j)).map((j) => line(from + 7, 16 + i * 22, to - 7, 16 + j * 22)))
    .join('');

export const DIAGRAMS: Record<string, string> = {
  attention: svg(
    96,
    'Scaled dot-product attention: Q and K are multiplied, scaled by the square root of d_k, passed through softmax, then used to weight V',
    box(8, 8, 32, 'Q') +
      box(8, 48, 32, 'K') +
      line(40, 20, 64, 36) +
      line(40, 60, 64, 36) +
      box(64, 24, 48, 'QKᵀ') +
      arrow(112, 36, 130, 36) +
      box(130, 24, 56, '÷ √dₖ') +
      arrow(186, 36, 204, 36) +
      box(204, 24, 64, 'softmax') +
      arrow(268, 36, 288, 36) +
      box(288, 24, 44, '× V') +
      box(288, 66, 44, 'V') +
      arrow(310, 66, 310, 48),
  ),
  'multi-head': svg(
    112,
    'Multi-head attention: Q, K and V go to h parallel attention heads whose outputs are concatenated and linearly projected',
    box(8, 44, 60, 'Q, K, V') +
      [8, 44, 80].map((y) => line(68, 56, 96, y + 12)).join('') +
      box(96, 8, 64, 'head 1') +
      box(96, 44, 64, 'head 2') +
      box(96, 80, 64, 'head h') +
      [8, 44, 80].map((y) => line(160, y + 12, 188, 56)).join('') +
      box(188, 44, 60, 'Concat') +
      arrow(248, 56, 266, 56) +
      box(266, 44, 66, 'Linear Wᴼ'),
  ),
  'encoder-decoder': svg(
    100,
    'Encoder-decoder: the encoder reads the input; the decoder generates the output from the encoder states and its own previous outputs',
    text(30, 46, 'input') +
      arrow(54, 42, 76, 42) +
      box(76, 30, 80, 'Encoder') +
      arrow(156, 42, 190, 42) +
      text(173, 34, 'states') +
      box(190, 30, 80, 'Decoder') +
      arrow(270, 42, 292, 42) +
      text(316, 46, 'output') +
      line(230, 84, 316, 84) +
      line(316, 84, 316, 54) +
      arrow(230, 84, 230, 54) +
      text(273, 98, 'outputs so far'),
  ),
  'positional-encoding': svg(
    112,
    'Positional encoding: each embedding dimension is a sine or cosine of the position with a different wavelength',
    [1, 0.4, 0.15]
      .map(
        (f, i) =>
          text(8, 24 + i * 32, `dim ${i * 2}`, 'start') +
          curve((p) => 0.5 + 0.4 * Math.sin(p * f), 0, 30, [56, 8 + i * 32, 276, 28]),
      )
      .join('') +
      arrow(56, 104, 332, 104) +
      text(194, 100, 'position'),
  ),
  residual: svg(
    92,
    'Residual connection: the input x skips around the layer F and is added to its output, giving x + F(x)',
    text(16, 64, 'x') +
      arrow(26, 60, 110, 60) +
      box(110, 48, 72, 'F(x)') +
      arrow(182, 60, 230, 60) +
      `<circle class="d-node" cx="240" cy="60" r="10"/>` +
      text(240, 64, '+') +
      line(60, 60, 60, 16) +
      line(60, 16, 240, 16) +
      arrow(240, 16, 240, 50) +
      text(150, 12, 'skip: x') +
      arrow(250, 60, 296, 60) +
      text(318, 64, 'x + F(x)'),
  ),
  dropout: svg(
    96,
    'Dropout: during training some units are switched off at random, so their connections carry nothing on that step',
    dropoutEdges(60, 170, [1, 3]) +
      dropoutNodes(60) +
      dropoutNodes(170, [1, 3]) +
      text(250, 40, 'dropped units', 'start') +
      text(250, 56, 'output 0 this step', 'start') +
      line(178, 38, 244, 38) +
      line(178, 82, 244, 44),
  ),
  softmax: svg(
    112,
    'Softmax: raw scores 2, 1, 0.1 and -1 become probabilities 0.64, 0.24, 0.10 and 0.03 that sum to 1',
    text(52, 12, 'scores') +
      line(8, 70, 100, 70) +
      bars(scores, 10, 70, 20) +
      arrow(116, 60, 168, 60) +
      text(142, 52, 'softmax') +
      text(250, 12, 'probabilities') +
      line(184, 100, 320, 100) +
      bars(probs, 196, 100, 80) +
      probs.map((p, i) => text(204 + i * 22, 110 - 14 - p * 80, p.toFixed(2).replace(/^0/, ''))).join(''),
  ),
  activations: svg(
    120,
    'Activation functions plotted from -3 to 3: ReLU, GELU and sigmoid',
    line(16, 8 + 100 * (1 - toUnit(0)), 236, 8 + 100 * (1 - toUnit(0))) +
      line(126, 8, 126, 108) +
      curve((x) => toUnit(Math.max(0, x)), -3, 3, [16, 8, 220, 100], 'd-curve') +
      curve((x) => toUnit(gelu(x)), -3, 3, [16, 8, 220, 100], 'd-curve2') +
      curve((x) => toUnit(1 / (1 + Math.exp(-x))), -3, 3, [16, 8, 220, 100], 'd-curve3') +
      `<line class="d-curve" x1="252" y1="30" x2="272" y2="30"/>` +
      text(280, 34, 'ReLU', 'start') +
      `<line class="d-curve2" x1="252" y1="54" x2="272" y2="54"/>` +
      text(280, 58, 'GELU', 'start') +
      `<line class="d-curve3" x1="252" y1="78" x2="272" y2="78"/>` +
      text(280, 82, 'sigmoid', 'start'),
  ),
};
