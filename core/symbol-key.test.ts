// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { symbolsIn } from './symbol-key';

const keys = (mathml: string): string[] => {
  const host = document.createElement('div');
  host.innerHTML = `<math>${mathml}</math>`;
  return symbolsIn(host.firstElementChild!).map((s) => s.key);
};

describe('symbolsIn', () => {
  it('reads single identifiers, including Greek and bold Unicode', () => {
    expect(keys('<mi>λ</mi><mo>+</mo><mi>𝐖</mi>')).toEqual(['λ', '𝐖']);
  });

  it('treats a subscripted identifier as one symbol', () => {
    expect(keys('<msub><mi>d</mi><mi>k</mi></msub>')).toEqual(['d_k']);
    expect(keys('<msub><mi>d</mi><mtext>model</mtext></msub>')).toEqual(['d_model']);
  });

  it('keeps naming superscripts but drops transpose, prime, inverse and powers', () => {
    expect(keys('<msup><mi>W</mi><mi>Q</mi></msup>')).toEqual(['W^Q']);
    expect(keys('<msup><mi>K</mi><mi>T</mi></msup>')).toEqual(['K']);
    expect(keys('<msup><mi>x</mi><mn>2</mn></msup>')).toEqual(['x']);
    expect(keys('<msup><mi>A</mi><mrow><mo>−</mo><mn>1</mn></mrow></msup>')).toEqual(['A']);
  });

  it('handles sub+superscript', () => {
    expect(keys('<msubsup><mi>W</mi><mi>i</mi><mi>Q</mi></msubsup>')).toEqual(['W_i^Q']);
    expect(keys('<msubsup><mi>h</mi><mi>t</mi><mo>′</mo></msubsup>')).toEqual(['h_t']);
  });

  it('distinguishes accented symbols from their base', () => {
    expect(keys('<mover><mi>y</mi><mo>^</mo></mover><mo>−</mo><mi>y</mi>')).toEqual(['^(y)', 'y']);
  });

  it('ignores multi-letter function names and annotations', () => {
    expect(
      keys(
        '<semantics><mrow><mi>softmax</mi><mo>(</mo><mi>z</mi><mo>)</mo></mrow>' +
          '<annotation encoding="application/x-tex">\\mathrm{softmax}(z)</annotation></semantics>',
      ),
    ).toEqual(['z']);
  });

  it('reads italic words split by invisible separators as one symbol (LaTeXML "pos")', () => {
    const sep = '<mo>​</mo>';
    expect(keys(`<mi>p</mi>${sep}<mi>o</mi>${sep}<mi>s</mi>`)).toEqual(['pos']);
    expect(keys(`<mi>Q</mi><mo>⁢</mo><mi>K</mi>`)).toEqual(['Q', 'K']);
  });

  it('strips invisible characters inside subscripts', () => {
    expect(keys('<msub><mi>d</mi><mrow><mi>f</mi><mo>​</mo><mi>f</mi></mrow></msub>')).toEqual(['d_ff']);
  });

  it('skips number sets, infinity and non-letters', () => {
    expect(keys('<mi>W</mi><mo>∈</mo><msup><mi>ℝ</mi><mi>d</mi></msup><mi>…</mi><mi>∞</mi>')).toEqual(['W', 'd']);
  });

  it('folds negative and fractional powers into the base', () => {
    expect(keys('<msup><mi>m</mi><mrow><mo>−</mo><mn>0.5</mn></mrow></msup>')).toEqual(['m']);
  });

  it('reads the attention formula in document order', () => {
    const attention =
      '<mrow><mi>Q</mi><msup><mi>K</mi><mi>T</mi></msup></mrow><mo>/</mo>' +
      '<msqrt><msub><mi>d</mi><mi>k</mi></msub></msqrt><mi>V</mi>';
    expect(keys(attention)).toEqual(['Q', 'K', 'd_k', 'V']);
  });
});
