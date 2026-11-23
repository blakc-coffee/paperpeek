// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { SymbolTable } from '../core/symbol-table';
import { extractOccurrences, splitSentences } from './arxiv-html';

// Minimal LaTeXML-shaped page (same markup as arxiv.org/html/1706.03762).
const m = (id: string, tex: string, mathml: string) =>
  `<math id="${id}" class="ltx_Math" alttext="${tex}" display="inline"><semantics><mrow>${mathml}</mrow>` +
  `<annotation encoding="application/x-tex">${tex}</annotation></semantics></math>`;
const dk = (id: string) => m(id, 'd_{k}', '<msub><mi>d</mi><mi>k</mi></msub>');

const PAGE = `
<section id="S3"><div class="ltx_para"><p class="ltx_p">
  The input consists of queries and keys of dimension ${dk('S3.p1.m1')}, and values of dimension
  ${m('S3.p1.m2', 'd_{v}', '<msub><mi>d</mi><mi>v</mi></msub>')}. We scale by ${dk('S3.p1.m3')} as in Vaswani et al. (2017).
</p></div></section>
<section id="S4"><div class="ltx_para"><p class="ltx_p">
  We use ${m('S4.p1.m1', 'h', '<mi>h</mi>')} heads. Let ${m('S4.p1.m2', 'h', '<mi>h</mi>')} be the number of parallel attention heads.
</p></div></section>
<section id="S5"><div class="ltx_para"><p class="ltx_p">
  From now on ${dk('S5.p1.m1')} denotes the per-head key size, which shrinks.
  Then ${m('S5.p1.m2', 'QK^{T}/\\sqrt{d_{k}}', '<mi>Q</mi><msup><mi>K</mi><mi>T</mi></msup><mo>/</mo><msqrt>' + '<msub><mi>d</mi><mi>k</mi></msub></msqrt>')} is computed.
</p></div></section>`;

describe('splitSentences', () => {
  it('does not split on abbreviations', () => {
    expect(splitSentences('As in Vaswani et al. (2017). See Fig. 2 for details. Done.')).toEqual([
      'As in Vaswani et al. (2017).',
      'See Fig. 2 for details.',
      'Done.',
    ]);
  });
});

describe('arXiv HTML adapter', () => {
  let table: SymbolTable;
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    table = new SymbolTable(extractOccurrences(document));
  });

  it('collects symbols in document order with their sections', () => {
    expect(table.occurrences('d_k').map((o) => [o.mathId, o.sectionId])).toEqual([
      ['S3.p1.m1', 'S3'],
      ['S3.p1.m3', 'S3'],
      ['S5.p1.m1', 'S5'],
      ['S5.p1.m2', 'S5'],
    ]);
    expect(table.keys.sort()).toEqual(['K', 'Q', 'd_k', 'd_v', 'h']);
  });

  it('attaches definitions with the source sentence in TeX', () => {
    const def = table.occurrences('d_v')[0]?.definition;
    expect(def?.gloss).toBe('values of dimension');
    expect(def?.sentence).toContain('values of dimension $d_{v}$.');
  });

  it('uses the nearest preceding definition, so redefinitions apply from then on', () => {
    const [first, , redefined, later] = table.occurrences('d_k');
    expect(table.lookup('d_k', first!.order)?.occurrence.definition?.gloss).toBe('queries and keys of dimension');
    expect(table.lookup('d_k', later!.order)?.occurrence.mathId).toBe(redefined!.mathId);
    expect(table.lookup('d_k', later!.order)?.occurrence.definition?.gloss).toBe('per-head key size');
  });

  it('points a use before its definition to the later definition', () => {
    const [use] = table.occurrences('h');
    expect(table.lookup('h', use!.order)).toMatchObject({
      kind: 'later',
      occurrence: { mathId: 'S4.p1.m2', definition: { gloss: 'number of parallel attention heads' } },
    });
  });

  it('does not let "Sublayer(x) is the function …" define x', () => {
    document.body.innerHTML = `<section id="S2"><p class="ltx_p">where ${m(
      'S2.m1',
      'Sublayer(x)',
      '<mi>Sublayer</mi><mo>(</mo><mi>x</mi><mo>)</mo>',
    )} is the function implemented by the sub-layer.</p></section>`;
    const t = new SymbolTable(extractOccurrences(document));
    expect(t.occurrences('x')[0]?.definition).toBeUndefined();
  });

  it('falls back to the first use when a symbol is never defined', () => {
    expect(table.lookup('Q', 999)).toMatchObject({ kind: 'first-use', occurrence: { mathId: 'S5.p1.m2' } });
  });
});
