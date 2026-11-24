// Interactive mini-demos shown inside term popups. Each is built only when the
// reader presses "Try it", from DOM APIs only, and updates SVG attributes in
// place on input (no re-render, no framework).

import { attentionWeights, descentPath, dropoutMask, gelu, nucleusSize, relu, sigmoid, softmax } from '../core/demo-math';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 340;

type Attrs = Record<string, string | number>;

function svgEl<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Attrs, text?: string): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG_NS, tag);
  set(node, attrs);
  if (text !== undefined) node.textContent = text;
  return node;
}

function set(node: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
}

function canvas(doc: Document, height: number, label: string): SVGSVGElement {
  return svgEl(doc, 'svg', { viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label });
}

/** A labelled range input; `render` runs now and on every input and returns the readout text. */
function slider(
  doc: Document,
  label: string,
  range: { min: number; max: number; step: number; value: number },
  render: (value: number) => string,
): HTMLElement {
  const row = doc.createElement('label');
  row.className = 'control';
  const name = doc.createElement('span');
  name.textContent = label;
  const input = doc.createElement('input');
  input.type = 'range';
  set(input, { min: range.min, max: range.max, step: range.step });
  input.value = String(range.value);
  const out = doc.createElement('output');
  out.setAttribute('aria-live', 'polite');
  const update = (): void => {
    out.textContent = render(Number(input.value));
  };
  input.addEventListener('input', update);
  update();
  row.append(name, input, out);
  return row;
}

function demo(doc: Document, ...children: Element[]): HTMLElement {
  const root = doc.createElement('div');
  root.className = 'demo';
  root.append(...children);
  return root;
}

/** Plot box shared by the function demos: x ∈ [x0, x1], y ∈ [y0, y1] → left 16..236, top 8..108. */
function plot(x0: number, x1: number, y0: number, y1: number) {
  const px = (x: number): number => 16 + ((x - x0) / (x1 - x0)) * 220;
  const py = (y: number): number => 108 - ((y - y0) / (y1 - y0)) * 100;
  const path = (f: (x: number) => number): string =>
    Array.from({ length: 61 }, (_, i) => x0 + ((x1 - x0) * i) / 60)
      .map((x) => `${px(x).toFixed(1)},${py(f(x)).toFixed(1)}`)
      .join(' ');
  return { px, py, path };
}

const LOGITS = [2, 1, 0.1, -1];

function softmaxDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 120, 'Softmax of the scores 2, 1, 0.1 and −1 at the chosen temperature');
  const bars = LOGITS.map((z, i) => {
    const x = 40 + i * 72;
    svg.append(svgEl(doc, 'text', { class: 'd-text', x: x + 20, y: 116, 'text-anchor': 'middle' }, `z = ${z}`));
    const bar = svgEl(doc, 'rect', { class: 'd-bar', x, width: 40, rx: 3 });
    const label = svgEl(doc, 'text', { class: 'd-text', x: x + 20, 'text-anchor': 'middle' });
    svg.append(bar, label);
    return { bar, label };
  });
  svg.append(svgEl(doc, 'line', { class: 'd-line', x1: 24, y1: 100, x2: 324, y2: 100 }));
  const control = slider(doc, 'Temperature T', { min: 0.1, max: 5, step: 0.1, value: 1 }, (t) => {
    softmax(LOGITS, t).forEach((p, i) => {
      const h = Math.max(1, p * 80);
      set(bars[i]!.bar, { y: 100 - h, height: h });
      set(bars[i]!.label, { y: 100 - h - 4 });
      bars[i]!.label.textContent = p.toFixed(2);
    });
    return `T = ${t.toFixed(1)}`;
  });
  return demo(doc, svg, control);
}

function activationsDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 116, 'ReLU, GELU and sigmoid evaluated at the chosen input');
  const { px, py, path } = plot(-3, 3, -1, 3);
  svg.append(
    svgEl(doc, 'line', { class: 'd-line', x1: 16, y1: py(0), x2: 236, y2: py(0) }),
    svgEl(doc, 'line', { class: 'd-line', x1: px(0), y1: 8, x2: px(0), y2: 108 }),
  );
  const fns = [
    { name: 'ReLU', f: relu, cls: 'd-curve' },
    { name: 'GELU', f: gelu, cls: 'd-curve2' },
    { name: 'sigmoid', f: sigmoid, cls: 'd-curve3' },
  ].map(({ name, f, cls }, i) => {
    svg.append(svgEl(doc, 'polyline', { class: cls, points: path(f) }));
    const dot = svgEl(doc, 'circle', { class: `${cls} d-dot`, r: 4 });
    const readout = svgEl(doc, 'text', { class: 'd-text', x: 250, y: 30 + i * 24 });
    svg.append(dot, readout);
    return { name, f, dot, readout };
  });
  const control = slider(doc, 'Input x', { min: -3, max: 3, step: 0.1, value: 1 }, (x) => {
    for (const { name, f, dot, readout } of fns) {
      set(dot, { cx: px(x), cy: py(Math.min(3, f(x))) });
      readout.textContent = `${name}: ${f(x).toFixed(2)}`;
    }
    return `x = ${x.toFixed(1)}`;
  });
  return demo(doc, svg, control);
}

const TOKENS = ['the', 'cat', 'sat', 'on', 'mat'];
// Toy 2-d embeddings: nouns point one way, function words another.
const EMBED = [
  [0.1, 0.9],
  [1, 0.2],
  [0.6, 0.6],
  [0.1, 1],
  [0.9, 0.3],
];

function attentionDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 120, 'Self-attention weights between five tokens; each row sums to 1');
  const cell = { w: 40, h: 18, x: 90, y: 20 };
  TOKENS.forEach((t, i) => {
    svg.append(
      svgEl(doc, 'text', { class: 'd-text', x: cell.x - 8, y: cell.y + i * cell.h + 13, 'text-anchor': 'end' }, t),
      svgEl(doc, 'text', { class: 'd-text', x: cell.x + i * cell.w + cell.w / 2, y: 14, 'text-anchor': 'middle' }, t),
    );
  });
  svg.append(svgEl(doc, 'text', { class: 'd-text', x: 8, y: 14 }, 'query ↓ key →'));
  const cells = TOKENS.map((_, i) =>
    TOKENS.map((_, j) => {
      const x = cell.x + j * cell.w;
      const y = cell.y + i * cell.h;
      const rect = svgEl(doc, 'rect', { class: 'd-bar', x: x + 1, y: y + 1, width: cell.w - 2, height: cell.h - 2, rx: 2 });
      const value = svgEl(doc, 'text', { class: 'd-text d-small', x: x + cell.w / 2, y: y + 13, 'text-anchor': 'middle' });
      svg.append(rect, value);
      return { rect, value };
    }),
  );
  const control = slider(doc, 'Score scale', { min: 0.5, max: 8, step: 0.5, value: 2 }, (scale) => {
    attentionWeights(EMBED, EMBED, scale).forEach((row, i) =>
      row.forEach((w, j) => {
        const c = cells[i]![j]!;
        set(c.rect, { 'fill-opacity': (0.08 + 0.92 * w).toFixed(3) });
        c.value.textContent = w.toFixed(2).replace(/^0/, '');
      }),
    );
    return `× ${scale.toFixed(1)}`;
  });
  return demo(doc, svg, control);
}

const STEPS = 10;
const X0 = 2.6;

function descentDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 116, 'Gradient descent on f(x) = x² for ten steps at the chosen learning rate');
  const { px, py, path } = plot(-3, 3, 0, 9);
  svg.append(svgEl(doc, 'polyline', { class: 'd-line d-thin', points: path((x) => x * x) }));
  const trail = svgEl(doc, 'polyline', { class: 'd-curve' });
  const dots = Array.from({ length: STEPS + 1 }, () => svgEl(doc, 'circle', { class: 'd-curve d-dot', r: 3 }));
  const readout = svgEl(doc, 'text', { class: 'd-text', x: 250, y: 50 });
  const readout2 = svgEl(doc, 'text', { class: 'd-text', x: 250, y: 66 });
  svg.append(trail, ...dots, readout, readout2);
  const clamp = (x: number): number => Math.max(-3, Math.min(3, x));
  const control = slider(doc, 'Learning rate η', { min: 0.02, max: 1.1, step: 0.02, value: 0.1 }, (lr) => {
    const xs = descentPath(X0, lr, STEPS);
    const pts = xs.map((x) => [px(clamp(x)), py(Math.min(9, x * x))] as const);
    set(trail, { points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ') });
    pts.forEach(([x, y], i) => set(dots[i]!, { cx: x.toFixed(1), cy: y.toFixed(1), 'fill-opacity': (0.3 + (0.7 * i) / STEPS).toFixed(2) }));
    const end = xs.at(-1) ?? X0;
    readout.textContent = `after ${STEPS} steps:`;
    readout2.textContent = Math.abs(end) > X0 ? 'diverges' : `x = ${end.toFixed(3)}`;
    return `η = ${lr.toFixed(2)}`;
  });
  return demo(doc, svg, control);
}

const ROWS = 3;
const COLS = 10;

function dropoutDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 96, 'A layer of thirty units with a random subset dropped at the chosen rate');
  const units = Array.from({ length: ROWS * COLS }, (_, i) =>
    svgEl(doc, 'circle', { cx: 24 + (i % COLS) * 30, cy: 18 + Math.floor(i / COLS) * 26, r: 9 }),
  );
  const readout = svgEl(doc, 'text', { class: 'd-text', x: 16, y: 92 });
  svg.append(...units, readout);
  let seed = 1;
  let p = 0.5;
  const draw = (): void => {
    const mask = dropoutMask(units.length, p, seed);
    mask.forEach((kept, i) => set(units[i]!, { class: kept ? 'd-node' : 'd-off' }));
    const kept = mask.filter(Boolean).length;
    readout.textContent = `${kept}/${units.length} kept · kept units scaled × ${p < 1 ? (1 / (1 - p)).toFixed(2) : '∞'}`;
  };
  const control = slider(doc, 'Drop rate p', { min: 0, max: 0.9, step: 0.05, value: p }, (value) => {
    p = value;
    draw();
    return `p = ${value.toFixed(2)}`;
  });
  const resample = doc.createElement('button');
  resample.type = 'button';
  resample.className = 'chip';
  resample.textContent = 'Resample';
  resample.addEventListener('click', () => {
    seed += 1;
    draw();
  });
  return demo(doc, svg, control, resample);
}

const NEXT_TOKENS = ['the', 'a', 'this', 'our', 'its', 'one', 'each', 'we'];
const NEXT_LOGITS = [3, 2.5, 2, 1.5, 1, 0.6, 0.3, 0];

/** The usual LLM sampling pipeline: softmax(z / T), then keep the top k, then the top-p nucleus. */
function samplingDemo(doc: Document): HTMLElement {
  const svg = canvas(doc, 118, 'Next-token probabilities after temperature; bars outside the top-k and top-p cut-offs are dimmed');
  const bars = NEXT_TOKENS.map((token, i) => {
    const x = 20 + i * 38;
    const bar = svgEl(doc, 'rect', { class: 'd-bar', x, width: 28, rx: 3 });
    const value = svgEl(doc, 'text', { class: 'd-text d-small', x: x + 14, 'text-anchor': 'middle' });
    svg.append(bar, value, svgEl(doc, 'text', { class: 'd-text', x: x + 14, y: 112, 'text-anchor': 'middle' }, token));
    return { bar, value };
  });
  svg.append(svgEl(doc, 'line', { class: 'd-line', x1: 14, y1: 96, x2: 326, y2: 96 }));
  const readout = svgEl(doc, 'text', { class: 'd-text', x: 326, y: 12, 'text-anchor': 'end' });
  svg.appendChild(readout);

  const state = { t: 1, k: 8, p: 0.9 };
  const draw = (): void => {
    const probs = softmax(NEXT_LOGITS, state.t);
    const kept = Math.min(state.k, nucleusSize(probs, state.p));
    probs.forEach((prob, i) => {
      const h = Math.max(1, prob * 120);
      set(bars[i]!.bar, { y: 96 - h, height: h, 'fill-opacity': i < kept ? 1 : 0.18 });
      set(bars[i]!.value, { y: 96 - h - 3 });
      bars[i]!.value.textContent = prob.toFixed(2).replace(/^0/, '');
    });
    readout.textContent = `samples from ${kept} of ${NEXT_TOKENS.length} tokens`;
  };
  const t = slider(doc, 'Temperature T', { min: 0.2, max: 3, step: 0.1, value: state.t }, (v) => {
    state.t = v;
    draw();
    return `T = ${v.toFixed(1)}`;
  });
  const k = slider(doc, 'Top-k', { min: 1, max: 8, step: 1, value: state.k }, (v) => {
    state.k = v;
    draw();
    return `k = ${v}`;
  });
  const p = slider(doc, 'Top-p', { min: 0.1, max: 1, step: 0.05, value: state.p }, (v) => {
    state.p = v;
    draw();
    return `p = ${v.toFixed(2)}`;
  });
  return demo(doc, svg, t, k, p);
}

export const DEMOS: Record<string, (doc: Document) => HTMLElement> = {
  softmax: softmaxDemo,
  activations: activationsDemo,
  attention: attentionDemo,
  'gradient-descent': descentDemo,
  dropout: dropoutDemo,
  sampling: samplingDemo,
};
