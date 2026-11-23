// Pure maths behind the popup demos, kept here so it is unit-tested apart from the UI.

/** softmax(z / T), shifted by max(z) so large scores can't overflow exp(). */
export function softmax(z: readonly number[], temperature = 1): number[] {
  const scaled = z.map((v) => v / temperature);
  const max = Math.max(...scaled);
  const exp = scaled.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / sum);
}

export const relu = (x: number): number => Math.max(0, x);
/** tanh approximation used by BERT and GPT-2. */
export const gelu = (x: number): number => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Gradient descent on f(x) = x² (gradient 2x): the visited points, x₀ first. */
export function descentPath(x0: number, learningRate: number, steps: number): number[] {
  const path = [x0];
  for (let i = 0; i < steps; i++) {
    const x = path[path.length - 1] ?? x0;
    path.push(x - learningRate * 2 * x);
  }
  return path;
}

/** Deterministic PRNG (mulberry32) so a dropout mask can be redrawn on demand and tested. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** true = unit kept. Each unit is dropped with probability p. */
export function dropoutMask(units: number, p: number, seed: number): boolean[] {
  const next = rng(seed);
  return Array.from({ length: units }, () => next() >= p);
}

/** Row-wise scaled dot-product attention weights softmax(QKᵀ · sharpness). */
export function attentionWeights(q: readonly number[][], k: readonly number[][], sharpness: number): number[][] {
  return q.map((qi) => softmax(k.map((kj) => qi.reduce((s, v, d) => s + v * (kj[d] ?? 0), 0) * sharpness)));
}
