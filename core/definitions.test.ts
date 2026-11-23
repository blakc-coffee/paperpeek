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

  it('starts the noun phrase after its last determiner and stops at verbs', () => {
    expect(glosses('as a function of the previous hidden state §0§ and the input.', math('h'))).toEqual({
      h: ['previous hidden state', 0.5],
    });
    expect(glosses('These generate a sequence of hidden states §0§.', math('h_t'))).toEqual({
      h_t: ['sequence of hidden states', 0.5],
    });
    expect(glosses('We employed label smoothing of value §0§.', math('ϵ_ls'))).toEqual({
      'ϵ_ls': ['label smoothing of value', 0.5],
    });
  });

  it('reads "X = <number> <noun phrase>"', () => {
    const n = { ...math('N'), assigns: true };
    expect(glosses('The encoder is a stack of §0§ identical layers.', n)).toEqual({ N: ['identical layers', 0.7] });
  });

  it('drops trailing conjunctions from glosses', () => {
    expect(glosses('where §0§ is the position and §1§ is the dimension.', math('pos'), math('i'))).toEqual({
      pos: ['position', 0.9],
      i: ['dimension', 0.9],
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

describe('gloss hygiene', () => {
  it('rejects a lone adverb or gerund as a weak appositive gloss', () => {
    const maths = [{ id: 'm0', keys: ['a'] }];
    expect(findDefinitions({ text: 'We simply §0§ here.', maths })).toEqual([]);
  });
});

describe('list and count patterns', () => {
  const maths = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, keys: [`s${i}`] }));
  const glosses = (text: string, n: number) =>
    Object.fromEntries(findDefinitions({ text, maths: maths(n) }).map((d) => [d.mathId, [d.gloss, d.confidence]]));

  it('reads later items of a where-list', () => {
    expect(glosses('where §0§ is a word embedding matrix, §1§ is the vocabulary size.', 2)).toMatchObject({
      m0: ['word embedding matrix', 0.9],
      m1: ['vocabulary size', 0.7],
    });
  });

  it('gives coordinated symbols the shared gloss', () => {
    expect(glosses('where §0§, §1§, and §2§ are additional trainable parameters.', 3)).toEqual({
      m0: ['additional trainable parameters', 0.9],
      m1: ['additional trainable parameters', 0.9],
      m2: ['additional trainable parameters', 0.9],
    });
  });

  it('reads a symbol before a plural noun as a low-confidence count', () => {
    expect(glosses('Given a mini-batch §0§ of §1§ examples, we train.', 2).m1).toEqual(['number of examples', 0.4]);
  });
});
