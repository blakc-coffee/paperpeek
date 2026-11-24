// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { SymbolTable, type Occurrence } from '../core/symbol-table';
import { compileMatcher } from '../core/glossary';
import { figureLabel, renderCard, renderFigureCard, renderTermCard, sectionLabel } from './card';
import { DEMOS } from './demos';
import { attachLookup, glossaryEntryFor, lookupText } from './lookup';
import { Popup } from './popup';
import { renderWikiCard } from './wiki-card';
import { TermIndex } from './terms';
import { attachHover, caretPoint, crossRefAt, figureRefAt, formulaAt, occurrenceAt } from './hover';
import { renderCitationCard, renderEquationCard, renderFormulaCard } from './card';
import { extractOccurrences, GENERIC } from '../adapters/arxiv-html';
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

describe('demos', () => {
  const slide = (root: HTMLElement, value: string) => {
    const input = root.querySelector('input[type=range]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    return root.querySelector('output')?.textContent;
  };

  it('builds every demo with a labelled slider and an SVG', () => {
    for (const [name, build] of Object.entries(DEMOS)) {
      const root = build(document);
      expect(root.querySelector('svg[role=img]'), name).not.toBeNull();
      expect(root.querySelector('label.control input[type=range]'), name).not.toBeNull();
      expect(root.querySelector('output')?.textContent, name).not.toBe('');
    }
  });

  it('softmax bars follow the temperature', () => {
    const root = DEMOS.softmax!(document);
    const top = () => root.querySelector('svg text:not([y="116"])')?.textContent;
    expect(slide(root, '0.1')).toBe('T = 0.1');
    expect(top()).toBe('1.00');
    slide(root, '5');
    expect(Number(top())).toBeLessThan(0.4);
  });

  it('gradient descent reports divergence above η = 1', () => {
    const root = DEMOS['gradient-descent']!(document);
    slide(root, '1.1');
    expect(root.textContent).toContain('diverges');
    slide(root, '0.5');
    expect(root.textContent).toContain('x = 0.000');
  });

  it('dropout resample redraws the mask', () => {
    const root = DEMOS.dropout!(document);
    const mask = () => Array.from(root.querySelectorAll('circle')).map((c) => c.getAttribute('class')).join();
    const before = mask();
    (root.querySelector('button.chip') as HTMLButtonElement).click();
    expect(mask()).not.toBe(before);
    slide(root, '0');
    expect(root.querySelectorAll('circle.d-off')).toHaveLength(0);
  });

  it('term card swaps the diagram for the demo and back', () => {
    const onResize = vi.fn();
    const card = renderTermCard(document, { ...GLOSSARY[0]!, demo: 'attention' }, onResize);
    const toggle = Array.from(card.querySelectorAll('button')).find((b) => b.textContent === '▶ Try it')!;
    toggle.click();
    expect(card.querySelector('.demo')).not.toBeNull();
    expect(card.querySelector('.diagram')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(card.querySelector('.demo')).toBeNull();
    expect(card.querySelector('.diagram svg')).not.toBeNull();
    expect(onResize).toHaveBeenCalledTimes(2);
  });
});

describe('lookupText', () => {
  const select = (html: string, selector: string) => {
    document.body.innerHTML = html;
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(selector)!);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    return lookupText(sel);
  };

  it('accepts short phrases, trimming punctuation', () => {
    expect(select('<p>We use <b> label smoothing, </b> here.</p>', 'b')).toBe('label smoothing');
  });

  it('rejects formulas, long selections and symbol-only text', () => {
    expect(select('<p><math><mi id="x">abc</mi></math></p>', '#x')).toBeNull();
    expect(select('<p><b>one two three four five six</b></p>', 'b')).toBeNull();
    expect(select('<p><b>x = 1</b></p>', 'b')).toBeNull();
  });
});

describe('glossaryEntryFor', () => {
  const match = compileMatcher(GLOSSARY);
  it('only answers when one term covers the whole selection', () => {
    expect(glossaryEntryFor('dropout', match)?.id).toBe('dropout');
    expect(glossaryEntryFor('dropout rate', match)).toBeUndefined();
    expect(glossaryEntryFor('beam search', match)).toBeUndefined();
  });
});

describe('renderWikiCard', () => {
  const summary = { title: 'Label noise', extract: 'Label noise is …', url: 'https://en.wikipedia.org/wiki/Label_noise', closest: true, thumbnail: { src: 'https://upload.wikimedia.org/a.png', width: 100, height: 80 } };

  it('asks before sending anything, then calls back on press', () => {
    const onLookup = vi.fn();
    const card = renderWikiCard(document, { s: 'ask', term: 'label smoothing', onLookup });
    expect(card.textContent).toContain('Sends only this term');
    (card.querySelector('button') as HTMLButtonElement).click();
    expect(onLookup).toHaveBeenCalledOnce();
  });

  it('shows the article with credit, a safe link and the closest-match note', () => {
    const card = renderWikiCard(document, { s: 'ok', term: 'label smoothing', summary });
    expect(card.querySelector('.term')?.textContent).toBe('Label noise');
    expect(card.textContent).toContain('Closest article for “label smoothing”');
    const a = card.querySelector('a')!;
    expect([a.href, a.target, a.rel]).toEqual([summary.url, '_blank', 'noopener noreferrer']);
    expect(card.querySelector('img')?.referrerPolicy).toBe('no-referrer');
    expect(card.textContent).toContain('CC BY-SA 4.0');
  });

  it('renders loading, missing and error states', () => {
    expect(renderWikiCard(document, { s: 'loading', term: 't' }).getAttribute('aria-busy')).toBe('true');
    expect(renderWikiCard(document, { s: 'missing', term: 't' }).textContent).toContain('No Wikipedia article');
    const retry = vi.fn();
    (renderWikiCard(document, { s: 'error', term: 't', retry }).querySelector('button') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('keyboard selection lookup', () => {
  it('looks up a Shift+Arrow selection once the reader pauses', () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<p>We apply <b>dropout</b> here.</p>';
      const show = vi.fn();
      const popup = { host: document.createElement('div'), show, replace: vi.fn(), relayout: vi.fn(), anchor: null } as unknown as Popup;
      const detach = attachLookup(document, { match: compileMatcher(GLOSSARY), popup, mode: async () => 'never', wikipedia: async () => null, allow: vi.fn() });
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('b')!);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true }));
      vi.advanceTimersByTime(399);
      expect(show).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(show).toHaveBeenCalledTimes(1);
      expect((show.mock.calls[0]![2] as HTMLElement).querySelector('.term')?.textContent).toBe('dropout');
      expect(show.mock.calls[0]![4]).toBe(true); // keyboard-opened: takes focus

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
      vi.advanceTimersByTime(1000);
      expect(show).toHaveBeenCalledTimes(1);
      detach();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Alt+Shift+P', () => {
  const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', code: 'KeyP', altKey: true, shiftKey: true }));
  const select = (el: Node) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  };

  it('opens a sticky popup for the symbol at the caret', () => {
    const { dk, defined } = fixture();
    const show = vi.fn();
    const popup = { host: document.createElement('div'), show, hide: vi.fn(), jumpTo: vi.fn(), relayout: vi.fn(), anchor: null, isOpen: false, sticky: false } as unknown as Popup;
    const terms = new TermIndex(document, [], compileMatcher(GLOSSARY));
    const detach = attachHover(document, { table: new SymbolTable([defined]), terms }, popup);
    select(dk.querySelector('mi')!);
    expect(caretPoint(document)?.target).toBe(dk.querySelector('mi'));
    press();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]![0]).toBe(dk);
    expect((show.mock.calls[0]![2] as HTMLElement).querySelector('.gloss')?.textContent).toBe('dimension of the keys');
    expect(show.mock.calls[0]![3]).toBe(true);
    expect(show.mock.calls[0]![4]).toBe(true); // keyboard-opened: takes focus
    detach();
  });

  it('Esc closes the popup and asks for focus to go back', () => {
    document.body.innerHTML = '<p>text</p>';
    const hide = vi.fn();
    const popup = { host: document.createElement('div'), show: vi.fn(), hide, anchor: {}, isOpen: true, sticky: true } as unknown as Popup;
    const detach = attachHover(document, { table: new SymbolTable([]), terms: new TermIndex(document, [], compileMatcher(GLOSSARY)) }, popup);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hide).toHaveBeenCalledWith(true);
    detach();
  });

  it('does nothing when the caret is on plain text', () => {
    document.body.innerHTML = '<p id="t">plain words</p>';
    const show = vi.fn();
    const popup = { host: document.createElement('div'), show, hide: vi.fn(), anchor: null, isOpen: false, sticky: false } as unknown as Popup;
    const detach = attachHover(document, { table: new SymbolTable([]), terms: new TermIndex(document, [], compileMatcher(GLOSSARY)) }, popup);
    select(document.getElementById('t')!);
    press();
    expect(show).not.toHaveBeenCalled();
    detach();
  });
});

describe('formula cards (KaTeX)', () => {
  it('finds the formula from a rendered glyph and lists each symbol with its definition', () => {
    const katex = (tex: string, mathml: string) =>
      `<span class="katex"><span class="katex-mathml"><math><semantics><mrow>${mathml}</mrow>` +
      `<annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>` +
      `<span class="katex-html" aria-hidden="true"><span class="mord glyph">${tex}</span></span></span>`;
    document.body.innerHTML = `<article>
      <p>Let ${katex('W', '<mi>W</mi>')} denote the weight matrix.</p>
      <p>Then ${katex('Wx+b', '<mi>W</mi><mo>+</mo><mi>b</mi>')} is computed.</p></article>`;
    const table = new SymbolTable(extractOccurrences(document, GENERIC));
    const glyph = document.querySelectorAll('.glyph')[1]!;
    const hit = formulaAt(table, glyph)!;
    expect(hit.el).toBe(document.querySelectorAll('.katex')[1]);
    expect(hit.occurrences.map((o) => o.key)).toEqual(['W', 'b']);

    const onJump = vi.fn();
    const card = renderFormulaCard(document, hit.occurrences.map((o) => ({ occurrence: o, result: table.lookup(o.key, o.order) })), onJump);
    const rows = Array.from(card.querySelectorAll('.row'));
    expect(rows.map((r) => r.querySelector('.gloss-sm')?.textContent)).toEqual(['weight matrix', 'Not defined in the text']);
    expect(rows[0]!.querySelector('math')).not.toBeNull();
    (rows[0]!.querySelector('.jump-sm') as HTMLButtonElement).click();
    expect(onJump).toHaveBeenCalledWith(document.querySelectorAll('.katex')[0]);
    expect(rows[1]!.querySelector('.jump-sm')).toBeNull();
  });
});

describe('TermIndex.at hit-testing', () => {
  /** Layout stub: each term's range occupies one line box; the caret API reports the paragraph's text node. */
  function setup(caret: 'standard' | 'legacy') {
    document.body.innerHTML = '<section id="S1"><p class="ltx_p">We use dropout and attention.</p></section>';
    const index = new TermIndex(document, document.querySelectorAll('.ltx_p'), compileMatcher(GLOSSARY));
    const text = document.querySelector('p')!.firstChild!;
    const boxes = new Map(index.hits.map((h, i) => [h, { left: 100 + i * 120, right: 180 + i * 120, top: 50, bottom: 70 }]));
    for (const [hit, box] of boxes) {
      hit.range.getClientRects = () => [{ ...box, width: box.right - box.left, height: 20, x: box.left, y: box.top }] as unknown as DOMRectList;
    }
    const doc = document as Document & { caretPositionFromPoint?: unknown; caretRangeFromPoint?: unknown };
    const saved = { pos: doc.caretPositionFromPoint, range: doc.caretRangeFromPoint };
    if (caret === 'standard') {
      Object.defineProperty(document, 'caretPositionFromPoint', { configurable: true, value: () => ({ offsetNode: text, offset: 0 }) });
    } else {
      delete (document as unknown as Record<string, unknown>).caretPositionFromPoint;
      Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: () => ({ startContainer: text }) });
    }
    const restore = () => {
      Object.defineProperty(document, 'caretPositionFromPoint', { configurable: true, value: saved.pos });
      Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: saved.range });
      if (saved.pos === undefined) delete (document as unknown as Record<string, unknown>).caretPositionFromPoint;
    };
    return { index, restore };
  }

  it('returns the term whose line box contains the point', () => {
    const { index, restore } = setup('standard');
    try {
      expect(index.hits.map((h) => h.entry.id)).toEqual(['dropout', 'attention']);
      expect(index.at(document, 150, 60)?.hit.entry.id).toBe('dropout');
      expect(index.at(document, 260, 60)?.hit.entry.id).toBe('attention');
      expect(index.at(document, 260, 60)?.rect.left).toBe(220);
    } finally {
      restore();
    }
  });

  it('returns nothing when the caret lands in text but the point is outside every term box', () => {
    const { index, restore } = setup('standard');
    try {
      expect(index.at(document, 500, 60)).toBeUndefined();
      expect(index.at(document, 150, 90)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('falls back to caretRangeFromPoint in older Chromium', () => {
    const { index, restore } = setup('legacy');
    try {
      expect('caretPositionFromPoint' in document).toBe(false);
      expect(index.at(document, 150, 60)?.hit.entry.id).toBe('dropout');
    } finally {
      restore();
    }
  });
});

describe('sampling demo', () => {
  it('dims tokens outside the top-k and top-p cut-offs', () => {
    const root = DEMOS.sampling!(document);
    const inputs = Array.from(root.querySelectorAll('input[type=range]')) as HTMLInputElement[];
    const setInput = (i: number, v: string) => {
      inputs[i]!.value = v;
      inputs[i]!.dispatchEvent(new Event('input'));
    };
    const kept = () => Array.from(root.querySelectorAll('rect.d-bar')).filter((r) => r.getAttribute('fill-opacity') === '1').length;
    expect(inputs).toHaveLength(3);
    setInput(2, '1');
    expect(kept()).toBe(8);
    setInput(1, '3');
    expect(kept()).toBe(3);
    expect(root.textContent).toContain('samples from 3 of 8 tokens');
    setInput(2, '0.1');
    expect(kept()).toBe(1);
    // Low temperature sharpens the distribution: a mid-size nucleus shrinks to the top token.
    setInput(1, '8');
    setInput(2, '0.9');
    const atT1 = kept();
    setInput(0, '0.2');
    expect(kept()).toBeLessThan(atT1);
  });
});

describe('popup focus', () => {
  const RECT = new DOMRect(10, 10, 20, 20);
  // happy-dom has no Popover API; a no-op is enough since focus is what these tests check.
  if (!('showPopover' in HTMLElement.prototype)) {
    Object.assign(HTMLElement.prototype, { showPopover() {}, hidePopover() {} });
  }
  const setup = () => {
    document.body.innerHTML = '<input id="before">';
    const before = document.getElementById('before') as HTMLInputElement;
    before.focus();
    const popup = new Popup(document);
    const card = document.createElement('div');
    const button = document.createElement('button');
    card.append('text', button);
    return { before, popup, card, button };
  };

  it('a keyboard-opened popup focuses its first button, and Esc returns focus', () => {
    const { before, popup, card, button } = setup();
    const focus = vi.spyOn(button, 'focus');
    popup.show({}, RECT, card, true, true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const back = vi.spyOn(before, 'focus');
    popup.hide(true);
    expect(back).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(before);
    popup.host.remove();
  });

  it('focuses the card itself when it has no button', () => {
    const { popup } = setup();
    const card = document.createElement('div');
    card.textContent = 'no controls';
    const focus = vi.spyOn(card, 'focus');
    popup.show({}, RECT, card, true, true);
    expect(card.tabIndex).toBe(-1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    popup.host.remove();
  });

  it('keeps focus on the new card when a keyboard popup swaps its content', () => {
    const { popup, card } = setup();
    popup.show({}, RECT, card, true, true);
    const next = document.createElement('div');
    const retry = document.createElement('button');
    next.append(retry);
    const focus = vi.spyOn(retry, 'focus');
    popup.replace(next);
    expect(focus).toHaveBeenCalled();
    popup.host.remove();
  });

  it('a mouse-opened popup does not steal focus', () => {
    const { before, popup, card, button } = setup();
    const focus = vi.spyOn(button, 'focus');
    popup.show({}, RECT, card, true);
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(before);
    popup.hide(true);
    expect(document.activeElement).toBe(before);
    popup.host.remove();
  });

  it('closing without Esc leaves focus where it is', () => {
    const { before, popup, card } = setup();
    popup.show({}, RECT, card, true, true);
    const focus = vi.spyOn(before, 'focus');
    popup.hide();
    expect(focus).not.toHaveBeenCalled();
    popup.host.remove();
  });
});

describe('mouse selection lookup', () => {
  it('does not ask the popup to take focus', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<p>We apply <b>dropout</b> here.</p>';
      const show = vi.fn();
      const popup = { host: document.createElement('div'), show, replace: vi.fn(), relayout: vi.fn(), anchor: null } as unknown as Popup;
      const detach = attachLookup(document, { match: compileMatcher(GLOSSARY), popup, mode: async () => 'never', wikipedia: async () => null, allow: vi.fn() });
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('b')!);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      document.querySelector('b')!.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, composed: true }));
      vi.advanceTimersByTime(1);
      expect(show).toHaveBeenCalledTimes(1);
      expect(show.mock.calls[0]![4]).toBe(false);
      detach();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Firefox consent card', () => {
  it('a lookup without consent shows the consent card and sends nothing', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<p>We use <b>zebra stripes</b> here.</p>';
      const show = vi.fn();
      const allow = vi.fn();
      const wikipedia = vi.fn(async () => null);
      const popup = { host: document.createElement('div'), show, replace: vi.fn(), relayout: vi.fn(), anchor: null } as unknown as Popup;
      const detach = attachLookup(document, { match: compileMatcher(GLOSSARY), popup, mode: async () => 'consent', wikipedia, allow });
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('b')!);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      document.querySelector('b')!.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, composed: true }));
      await vi.advanceTimersByTimeAsync(1);
      expect(show).toHaveBeenCalledTimes(1);
      const card = show.mock.calls[0]![2] as HTMLElement;
      expect(card.classList.contains('is-consent')).toBe(true);
      card.querySelector('button')!.click();
      expect(allow).toHaveBeenCalledTimes(1);
      expect(wikipedia).not.toHaveBeenCalled();
      detach();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('equation and citation previews', () => {
  function page() {
    document.body.innerHTML = `
      <section id="S2"><h2 class="ltx_title">2 Method</h2>
        <p class="ltx_p">As in Eq. <a class="ltx_ref" href="#S2.E1">1</a> and prior work <a class="ltx_ref" href="#bib.bib13">13</a>,
          see also <a class="ltx_ref" href="#bib.bib7">7</a>.</p>
        <table id="S2.E1" class="ltx_equation ltx_eqn_table"><tr><td><math onclick="x()"><mi>h</mi><mo>=</mo><mi>W</mi><mi>x</mi></math></td>
          <td><span class="ltx_tag ltx_tag_equation">(1)</span></td></tr></table>
      </section>
      <section id="bib"><ul>
        <li id="bib.bib7" class="ltx_bibitem"><span class="ltx_tag ltx_tag_bibitem">[7]</span>
          <span class="ltx_bibblock">Ashish Vaswani et al.</span>
          <span class="ltx_bibblock">Attention is all you need. arXiv:1706.03762, 2017.</span></li>
        <li id="bib.bib13" class="ltx_bibitem"><span class="ltx_tag ltx_tag_bibitem">[13]</span>
          <span class="ltx_bibblock">Sepp Hochreiter and Jürgen Schmidhuber.</span>
          <span class="ltx_bibblock">Long short-term memory.</span></li>
      </ul></section>`;
    const refs = Array.from(document.querySelectorAll('a.ltx_ref'));
    return { eqRef: refs[0]!, bibRef: refs[1]!, arxivRef: refs[2]! };
  }

  it('resolves links to equations and bibliography entries by kind', () => {
    const { eqRef, bibRef } = page();
    expect(crossRefAt(document, eqRef)?.kind).toBe('equation');
    expect(crossRefAt(document, bibRef)?.kind).toBe('citation');
    expect(figureRefAt(document, eqRef)).toBeUndefined();
  });

  it('shows the equation MathML without page handlers, labelled by its number', () => {
    const { eqRef } = page();
    const eq = document.getElementById('S2.E1')!;
    const onJump = vi.fn();
    const card = renderEquationCard(document, eqRef, eq, onJump);
    expect(card.querySelector('.term')?.textContent).toBe('Equation (1)');
    expect(card.querySelectorAll('.equation math')).toHaveLength(1);
    expect(card.querySelector('[onclick]')).toBeNull();
    (card.querySelector('.jump') as HTMLButtonElement).click();
    expect(onJump).toHaveBeenCalledWith(eq);
    expect(card.querySelector('.jump')?.textContent).toBe('↓ Jump to Equation (1)');
  });

  it('shows the reference text, and an arXiv link only when the entry names one', () => {
    const { bibRef, arxivRef } = page();
    const plain = renderCitationCard(document, bibRef, document.getElementById('bib.bib13')!, () => {});
    expect(plain.querySelector('.term')?.textContent).toBe('Reference [13]');
    expect(plain.querySelector('.extract')?.textContent).toBe('Sepp Hochreiter and Jürgen Schmidhuber. Long short-term memory.');
    expect(plain.querySelector('a')).toBeNull();
    const withArxiv = renderCitationCard(document, arxivRef, document.getElementById('bib.bib7')!, () => {});
    const a = withArxiv.querySelector('a')!;
    expect([a.href, a.rel]).toEqual(['https://arxiv.org/abs/1706.03762', 'noopener noreferrer']);
  });
});
