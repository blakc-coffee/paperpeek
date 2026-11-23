import { describe, expect, it } from 'vitest';
import { attentionWeights, descentPath, dropoutMask, gelu, nucleusSize, relu, sigmoid, softmax } from './demo-math';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('softmax', () => {
  it('gives probabilities that sum to 1', () => {
    const p = softmax([2, 1, 0.1, -1]);
    expect(sum(p)).toBeCloseTo(1, 12);
    expect(p[0]).toBeCloseTo(0.638, 3);
  });

  it('sharpens at low temperature and flattens at high temperature', () => {
    expect(softmax([2, 1, 0], 0.1)[0]).toBeGreaterThan(0.99);
    const flat = softmax([2, 1, 0], 100);
    expect(Math.max(...flat) - Math.min(...flat)).toBeLessThan(0.01);
  });

  it('does not overflow on large scores', () => {
    expect(softmax([1000, 999])).toEqual([expect.closeTo(0.731, 3), expect.closeTo(0.269, 3)]);
  });
});

describe('activations', () => {
  it('match their definitions at known points', () => {
    expect([relu(-2), relu(3)]).toEqual([0, 3]);
    expect(sigmoid(0)).toBe(0.5);
    expect(gelu(0)).toBe(0);
    expect(gelu(3)).toBeCloseTo(2.996, 3);
    expect(gelu(-3)).toBeCloseTo(-0.004, 3);
  });
});

describe('descentPath', () => {
  it('converges for small learning rates and diverges above 1', () => {
    expect(Math.abs(descentPath(2, 0.1, 30).at(-1)!)).toBeLessThan(0.01);
    expect(descentPath(2, 0.5, 1)).toEqual([2, 0]);
    expect(Math.abs(descentPath(2, 1.1, 10).at(-1)!)).toBeGreaterThan(2);
  });
});

describe('dropoutMask', () => {
  it('is deterministic per seed and drops about p of the units', () => {
    expect(dropoutMask(20, 0.5, 7)).toEqual(dropoutMask(20, 0.5, 7));
    const kept = dropoutMask(10_000, 0.3, 1).filter(Boolean).length;
    expect(kept / 10_000).toBeCloseTo(0.7, 1);
    expect(dropoutMask(5, 0, 3).every(Boolean)).toBe(true);
  });
});

describe('attentionWeights', () => {
  it('returns one probability row per query, peaked on the most similar key', () => {
    const w = attentionWeights([[1, 0], [0, 1]], [[1, 0], [0, 1], [0.5, 0.5]], 4);
    expect(w.map(sum).map((s) => Number(s.toFixed(12)))).toEqual([1, 1]);
    expect(w[0]!.indexOf(Math.max(...w[0]!))).toBe(0);
    expect(w[1]!.indexOf(Math.max(...w[1]!))).toBe(1);
  });
});

describe('nucleusSize', () => {
  const probs = [0.38, 0.22, 0.14, 0.09, 0.07, 0.05, 0.03, 0.02];
  it('keeps the smallest prefix whose mass reaches p', () => {
    expect(nucleusSize(probs, 0.8)).toBe(4);
    expect(nucleusSize(probs, 0.6)).toBe(2);
    expect(nucleusSize(probs, 0.1)).toBe(1);
    expect(nucleusSize(probs, 1)).toBe(8);
  });
});
