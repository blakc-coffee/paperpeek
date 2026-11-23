import { describe, expect, it } from 'vitest';
import glossary from '../data/glossary/core.json';
import generated from '../data/glossary/generated.json';
import { DIAGRAMS } from '../data/glossary/diagrams';
import { compileMatcher, type GlossaryEntry } from './glossary';

const entries: GlossaryEntry[] = glossary.entries;
const match = compileMatcher(entries);
const found = (text: string) => match(text).map((m) => [text.slice(m.start, m.end), m.entry.id]);

describe('compileMatcher', () => {
  it('prefers the longest term', () => {
    expect(found('We use multi-head attention and attention.')).toEqual([
      ['multi-head attention', 'multi-head-attention'],
      ['attention', 'attention'],
    ]);
  });

  it('ignores case, hyphen-vs-space and plurals', () => {
    expect(found('Self Attention layers, two Transformers and some logits')).toEqual([
      ['Self Attention', 'self-attention'],
      ['Transformers', 'transformer'],
      ['logits', 'logit'],
    ]);
    expect(found('layer normalizations')).toEqual([['layer normalizations', 'layer-normalization']]);
  });

  it('matches whole words only', () => {
    expect(found('adamant tokenized encoders')).toEqual([['encoders', 'encoder']]);
    expect(found('pre-attention')).toEqual([]);
  });

  it('resolves aliases to their entry', () => {
    expect(found('an LSTM with ReLU')).toEqual([
      ['LSTM', 'lstm'],
      ['ReLU', 'relu'],
    ]);
  });
});

describe('bundled glossary', () => {
  it('has at least 60 entries with unique ids and names', () => {
    expect(entries.length).toBeGreaterThanOrEqual(60);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    const names = entries.flatMap((e) => [e.term, ...(e.aliases ?? [])].map((n) => n.toLowerCase().replace(/[-–\s]+/g, ' ')));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('keeps explanations short and diagrams resolvable', () => {
    for (const e of entries) {
      expect(e.short.length, e.id).toBeLessThanOrEqual(220);
      if (e.diagram) expect(DIAGRAMS[e.diagram], e.id).toMatch(/^<svg /);
    }
    expect(glossary.license).toBe('CC-BY-4.0');
  });
});

describe('formulas', () => {
  it('use Unicode, not LaTeX braces', () => {
    for (const e of entries) if (e.formula) expect(e.formula, e.id).not.toMatch(/[\^_]\{|\[a-z]/);
  });
});

describe('generated glossary', () => {
  const all: GlossaryEntry[] = [...entries, ...generated.entries];

  it('brings the bundle past 400 terms, every generated entry carrying its source and license', () => {
    expect(all.length).toBeGreaterThan(400);
    for (const e of generated.entries) {
      expect(e.source, e.id).toMatch(/^(Aalto Dictionary of ML \(adapted\)|Wikidata)$/);
      expect(e.license, e.id).toMatch(/^(CC BY 4\.0|CC0)$/);
      expect(e.url, e.id).toMatch(/^https:\/\//);
      expect(e.short.length, e.id).toBeLessThanOrEqual(220);
    }
  });

  it('never reuses a core name, so every name maps to one entry', () => {
    const names = all.flatMap((e) => [e.term, ...(e.aliases ?? [])].map((n) => n.toLowerCase().replace(/[-–\s]+/g, ' ').trim()));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('matches generated terms through the shared matcher', () => {
    const match = compileMatcher(all);
    expect(match('we use beam search and a recurrent neural network').map((m) => m.entry.id)).toEqual(['beam-search', 'rnn']);
    expect(match('a data point').map((m) => m.entry.source)).toEqual(['Aalto Dictionary of ML (adapted)']);
  });
});
