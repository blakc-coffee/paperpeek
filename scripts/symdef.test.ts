import { describe, expect, it } from 'vitest';
import { predict, score } from './symdef';

const row = (tokens: string, labels: string, label: 'definition' | 'none') => ({
  tokens: tokens.split(' '),
  labels: labels.split(' '),
  symbols: ['[[ V ]]', '[[ W ]]'],
  label,
});

describe('SymDef scoring', () => {
  const hit = row('where </s> SYMBOL </s> is the vocabulary size .', 'O O B-TERM O O O B-DEF I-DEF O', 'definition');
  const miss = row('Hence </s> SYMBOL </s> grows .', 'O O B-TERM O O O', 'none');

  it('rebuilds placeholders and predicts for the target symbol only', () => {
    expect(predict(hit)).toEqual({ gold: true, goldDef: ['vocabulary', 'size'], predicted: { gloss: 'vocabulary size', confidence: 0.9 } });
    expect(predict(miss).predicted).toBeNull();
  });

  it('computes precision, recall and gloss overlap', () => {
    const s = score([predict(hit), predict(miss)], 0.7);
    expect([s.tp, s.fp, s.fn, s.precision, s.recall, s.spanF1]).toEqual([1, 0, 0, 1, 1, 1]);
  });
});
