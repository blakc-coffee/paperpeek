import { describe, expect, it } from 'vitest';
import { findDefinitions, type SentenceMath } from './definitions';

const math = (...keys: string[]): SentenceMath => ({ id: `m-${keys[0]}`, keys });
const glosses = (text: string, ...maths: SentenceMath[]) =>
  Object.fromEntries(findDefinitions({ text, maths }).map((d) => [d.key, [d.gloss, d.confidence]]));

describe('findDefinitions', () => {
  it('reads "where X is …"', () => {
    expect(glosses('Here §0§ is scaled, where §1§ is the dimension of the keys.', math('A'), math('d_k')))
      .toEqual({ d_k: ['dimension of the keys', 0.9] });
  });

  it('reads "let X be …" and "X denotes …"', () => {
    expect(glosses('Let §0§ be the number of attention heads.', math('h'))).toEqual({
      h: ['number of attention heads', 0.9],
    });
    expect(glosses('§0§ denotes the learning rate, which decays.', math('η'))).toEqual({
      η: ['learning rate', 0.9],
    });
  });

  it('reads "denote … by X"', () => {
    expect(glosses('We denote the number of layers by §0§.', math('N'))).toEqual({
      N: ['number of layers', 0.9],
    });
  });

  it('reads a sentence-initial "X is the …"', () => {
    expect(glosses('§0§ is the hidden state at time t.', math('h_t'))).toEqual({
      h_t: ['hidden state at time t', 0.7],
    });
  });

  it('falls back to the noun phrase right before the symbol', () => {
    expect(
      glosses(
        'The input consists of queries and keys of dimension §0§, and values of dimension §1§.',
        math('d_k'),
        math('d_v'),
      ),
    ).toEqual({
      d_k: ['queries and keys of dimension', 0.5],
      d_v: ['values of dimension', 0.5],
    });
  });

  it('defines the first symbol of a multi-symbol formula', () => {
    expect(glosses('with projection matrices §0§.', math('W_i^Q', 'd_model', 'd_k'))).toEqual({
      'W_i^Q': ['projection matrices', 0.5],
    });
  });

  it('ignores symbols that are only used, not defined', () => {
    expect(glosses('We compute §0§ efficiently.', math('Q'))).toEqual({});
    expect(glosses('This is the sum of §0§ and §1§.', math('x'), math('y'))).toEqual({});
  });
});
