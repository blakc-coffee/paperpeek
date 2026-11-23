import { describe, expect, it } from 'vitest';
import glossary from '../data/glossary/core.json';
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
