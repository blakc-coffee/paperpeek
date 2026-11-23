// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { SymbolTable, type Occurrence } from '../core/symbol-table';
import { compileMatcher } from '../core/glossary';
import { figureLabel, renderCard, renderFigureCard, renderTermCard, sectionLabel } from './card';
import { TermIndex } from './terms';
import { figureRefAt, occurrenceAt } from './hover';
import { place } from './place';

const VIEW = { width: 1280, height: 800 };
const SIZE = { width: 360, height: 140 };

describe('place', () => {
  it('opens below the anchor, centred', () => {
    expect(place({ left: 600, top: 100, right: 620, bottom: 120 }, SIZE, VIEW)).toEqual({
      left: 430,
      top: 128,
      side: 'below',
    });
  });

  it('flips above when there is no room below', () => {
    expect(place({ left: 600, top: 740, right: 620, bottom: 760 }, SIZE, VIEW)).toMatchObject({
      top: 740 - 8 - 140,
      side: 'above',
    });
  });

  it('stays 16px inside the viewport edges', () => {
    expect(place({ left: 2, top: 100, right: 10, bottom: 120 }, SIZE, VIEW).left).toBe(16);
    expect(place({ left: 1270, top: 100, right: 1278, bottom: 120 }, SIZE, VIEW).left).toBe(1280 - 360 - 16);
  });
});

function fixture() {
  document.body.innerHTML = `
    <section id="S3"><h3 class="ltx_title">3.2.1 Scaled Dot-Product Attention</h3>
      <math id="m1"><msub onclick="alert(1)"><mi>d</mi><mi>k</mi></msub></math>
      <math id="m2"><mi>Q</mi></math>
    </section>`;
  const [dk, q] = [document.querySelector('msub')!, document.querySelector('#m2 mi')!];
  const defined: Occurrence = {
    key: 'd_k', order: 0, mathId: 'm1', sectionId: 'S3', el: dk,
    definition: { gloss: 'dimension of the keys', confidence: 0.9, sentence: '', parts: ['keys of dimension ', document.querySelector('#m1')!, '.'] },
  };
  const undefinedQ: Occurrence = { key: 'Q', order: 1, mathId: 'm2', sectionId: 'S3', el: q };
  return { dk, q, defined, undefinedQ };
}

describe('renderCard', () => {
  it('shows gloss, section, quoted sentence with cloned MathML, and jumps', () => {
    const { dk, defined } = fixture();
    const onJump = vi.fn();
    const card = renderCard(document, dk, { occurrence: defined, kind: 'preceding' }, onJump);
    expect(card.querySelector('.gloss')?.textContent).toBe('dimension of the keys');
    expect(card.querySelector('.badge')?.textContent).toBe('§ 3.2.1 Scaled Dot-Product Attention');
    expect(card.querySelector('.quote')?.textContent).toContain('keys of dimension');
    expect(card.querySelectorAll('.quote math')).toHaveLength(1);
    (card.querySelector('.jump') as HTMLButtonElement).click();
    expect(onJump).toHaveBeenCalledWith(dk);
  });

  it('strips event handlers and ids from cloned page markup', () => {
    const { dk, defined } = fixture();
    const card = renderCard(document, dk, { occurrence: defined, kind: 'preceding' }, () => {});
    expect(card.querySelector('[onclick]')).toBeNull();
    expect(card.querySelector('[id]')).toBeNull();
  });

  it('renders the partial state when a symbol is never defined', () => {
    const { q, undefinedQ } = fixture();
    const card = renderCard(document, q, { occurrence: undefinedQ, kind: 'first-use' }, () => {});
    expect(card.classList.contains('is-partial')).toBe(true);
    expect(card.querySelector('.gloss')?.textContent).toBe('Not defined in the text');
    expect(card.querySelector('.quote')).toBeNull();
    expect(card.querySelector('.jump')?.textContent).toBe('Jump to first use');
  });
});

describe('sectionLabel', () => {
  it('truncates long headings', () => {
    document.body.innerHTML = `<section id="S9"><h2 class="ltx_title">9 A Very Long Section Title About Everything</h2></section>`;
    expect(sectionLabel(document, 'S9')).toBe('9 A Very Long Section Title About Every…');
    expect(sectionLabel(document, null)).toBe('');
  });
});

describe('occurrenceAt', () => {
  it('climbs from a hovered glyph to its symbol, but not past the formula', () => {
    const { dk, defined, q } = fixture();
    const table = new SymbolTable([defined]);
    expect(occurrenceAt(table, dk.querySelector('mi'))).toBe(defined);
    expect(occurrenceAt(table, q)).toBeUndefined();
    expect(occurrenceAt(table, document.body)).toBeUndefined();
  });
});

function figures() {
  document.body.innerHTML = `
    <section id="S3"><h2 class="ltx_title">3 Model Architecture</h2>
      <p>As shown in <a class="ltx_ref" href="#S3.F2"><span class="ltx_ref_tag">2</span></a>, and
        <a class="ltx_ref" href="#S4.T1">1</a>, see <a class="ltx_ref" href="#S9">9</a>.</p>
      <figure id="S3.F2" class="ltx_figure">
        <img src="1706.03762v7/Figures/a.png" width="267" height="531" alt="Refer to caption">
        <img src="javascript:alert(1)" width="10" height="10">
        <figcaption><span class="ltx_tag ltx_tag_figure">Figure 2: </span>(left) Scaled <math><mi>x</mi></math> attention.</figcaption>
      </figure>
    </section>
    <section id="S4">
      <figure id="S4.T1" class="ltx_table">
        <figcaption><span class="ltx_tag">Table 1: </span>Path lengths.</figcaption>
        <table onclick="alert(1)"><tr><td style="color:red">Self-Attention</td><td><img src="x.png"></td></tr></table>
      </figure>
      <p>Back to <a class="ltx_ref" href="#S3.F2">2</a>.</p>
    </section>`;
  const refs = Array.from(document.querySelectorAll('a.ltx_ref'));
  return { refs, fig: document.getElementById('S3.F2')!, tab: document.getElementById('S4.T1')! };
}

describe('figureRefAt', () => {
  it('resolves links to figures and tables, ignoring section refs', () => {
    const { refs, fig, tab } = figures();
    expect(figureRefAt(document, refs[0]!.firstElementChild)).toEqual({ ref: refs[0], figure: fig });
    expect(figureRefAt(document, refs[1]!)?.figure).toBe(tab);
    expect(figureRefAt(document, refs[2]!)).toBeUndefined();
    expect(figureRefAt(document, document.body)).toBeUndefined();
  });
});

describe('renderFigureCard', () => {
  it('shows the figure images with absolute http(s) URLs, the caption, and a jump', () => {
    const { refs, fig } = figures();
    const onJump = vi.fn();
    const card = renderFigureCard(document, refs[0]!, fig, onJump);
    const imgs = Array.from(card.querySelectorAll('img'));
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.src).toMatch(/^https?:\/\/.*\/1706\.03762v7\/Figures\/a\.png$/);
    expect([imgs[0]!.width, imgs[0]!.height, imgs[0]!.alt]).toEqual([267, 531, '']);
    expect(card.querySelector('.caption')?.textContent?.trim()).toBe('(left) Scaled x attention.');
    expect(card.querySelectorAll('.caption math')).toHaveLength(1);
    const jump = card.querySelector('.jump') as HTMLButtonElement;
    expect(jump.textContent).toBe('↓ Jump to Figure 2');
    expect(card.querySelector('.note')?.textContent).toBe('§ 3 Model Architecture');
    jump.click();
    expect(onJump).toHaveBeenCalledWith(fig);
  });

  it('points up when the figure comes before the reference', () => {
    const { refs, fig } = figures();
    expect(renderFigureCard(document, refs[3]!, fig, () => {}).querySelector('.jump')?.textContent).toBe(
      '↑ Jump to Figure 2',
    );
  });

  it('clones tables without handlers, styles or images', () => {
    const { refs, tab } = figures();
    const card = renderFigureCard(document, refs[1]!, tab, () => {});
    expect(figureLabel(tab)).toBe('Table 1');
    expect(card.querySelector('.media table')?.textContent).toContain('Self-Attention');
    expect(card.querySelector('[onclick], [style], img')).toBeNull();
  });
});

const GLOSSARY = [
  { id: 'attention', term: 'attention', short: 'Weighted average of inputs.', formula: 'softmax(QKᵀ/√dₖ)V', diagram: 'attention' },
  { id: 'dropout', term: 'dropout', short: 'Randomly zeroes activations.' },
];

describe('TermIndex', () => {
  it('indexes the first use of each term per section, skipping math, links and citations', () => {
    document.body.innerHTML = `
      <section id="S1">
        <p class="ltx_p">We apply <a>dropout</a> then attention <math><mi>x</mi></math>, then attention again and dropout.</p>
        <p class="ltx_p">More attention.</p>
      </section>
      <section id="S2"><p class="ltx_p">Attention <cite class="ltx_cite">dropout</cite>.</p></section>`;
    const index = new TermIndex(document, document.querySelectorAll('.ltx_p'), compileMatcher(GLOSSARY));
    expect(index.hits.map((h) => [h.range.toString(), h.entry.id, h.range.startContainer.parentElement?.closest('section')?.id])).toEqual([
      ['attention', 'attention', 'S1'],
      ['dropout', 'dropout', 'S1'],
      ['Attention', 'attention', 'S2'],
    ]);
  });
});

describe('renderTermCard', () => {
  it('shows term, explanation, formula, our own diagram and the source', () => {
    const card = renderTermCard(document, GLOSSARY[0]!);
    expect(card.querySelector('.term')?.textContent).toBe('attention');
    expect(card.querySelector('.short')?.textContent).toBe('Weighted average of inputs.');
    expect(card.querySelector('.formula')?.textContent).toBe('softmax(QKᵀ/√dₖ)V');
    expect(card.querySelector('.diagram svg')?.getAttribute('role')).toBe('img');
    expect(card.querySelector('.note')?.textContent).toContain('CC BY 4.0');
  });

  it('omits formula and diagram when the entry has none', () => {
    const card = renderTermCard(document, GLOSSARY[1]!);
    expect(card.querySelector('.formula, .diagram')).toBeNull();
  });
});
