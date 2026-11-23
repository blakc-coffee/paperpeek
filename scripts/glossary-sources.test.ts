import { describe, expect, it } from 'vitest';
import { firstSentence, fromAdictml, fromWikidata, latexToText, mergeGlossaries } from './glossary-sources';

const TEX = String.raw`
% a comment with {braces
\newglossaryentry{mab}
{name={multiarmed bandit (MAB)},
 plural={MABs},
 description={A \gls{mab} is a sequential decision problem\index{MAB} \cite{Lattimore2020}, \cite{x}.
   It has $K$ arms.},
 text={MAB}
}
\newglossaryentry{smab}
{name={stochastic multiarmed bandit},
 description={A stochastic MAB is obtained from an \gls{mab} by adding noise, see \emph{Chapter~2} \cite{a}.}
}
\newglossaryentry{loss}
{name={loss},
 description={The loss $L$ measures error.}
}
\newglossaryentry{datapoint}
{name={data point},
 plural={data points},
 description={${'``'}Data points'' are objects; \Glspl{datapoint} carry features---like \glspl{mab}---and labels.}
}`;

describe('ADictML parsing', () => {
  const entries = fromAdictml([TEX]);
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));

  it('reads nested-brace fields and splits acronyms into aliases', () => {
    expect(byId['adictml:mab']).toMatchObject({
      term: 'multiarmed bandit',
      aliases: ['MAB'],
      short: 'A multiarmed bandit is a sequential decision problem.',
      license: 'CC BY 4.0',
    });
  });

  it('expands \\gls to the entry name, fixes the article, drops citations and formatting', () => {
    expect(byId['adictml:smab']?.short).toBe('A stochastic MAB is obtained from a multiarmed bandit by adding noise, see Chapter 2.');
  });

  it('skips definitions whose first sentence has maths or is too short', () => {
    expect(byId['adictml:loss']).toBeUndefined();
  });

  it('handles plurals, capitalised \\Glspl, quotes and dashes', () => {
    expect(byId['adictml:datapoint']?.short).toBe('"Data points" are objects; Data points carry features—like multiarmed bandits—and labels.');
  });
});

describe('latexToText / firstSentence', () => {
  it('leaves a marker when maths remains so the entry is rejected', () => {
    expect(firstSentence(latexToText('Let $x$ be a vector of numbers here.', (k) => k))).toBeNull();
  });
});

describe('Wikidata parsing', () => {
  const row = (label: string, desc: string, alts = '') => ({
    item: { value: `http://www.wikidata.org/entity/Q${label.length}` },
    label: { value: label },
    desc: { value: desc },
    article: { value: `https://en.wikipedia.org/wiki/${label}` },
    alts: { value: alts },
  });

  it('keeps concepts with a sentence-cased description, link and filtered aliases', () => {
    expect(fromWikidata([row('word embedding', 'technique in natural language processing , vectors', 'word vector|model|word embedding')])).toEqual([
      {
        id: 'wikidata:Q14',
        term: 'word embedding',
        aliases: ['word vector'],
        short: 'Technique in natural language processing, vectors.',
        source: 'Wikidata',
        license: 'CC0',
        url: 'https://en.wikipedia.org/wiki/word embedding',
      },
    ]);
  });

  it('drops products, very short descriptions and short labels', () => {
    expect(fromWikidata([row('Midjourney', 'AI art generator program'), row('lasso', 'statistical method'), row('AI', 'artificial intelligence field')])).toEqual([]);
  });
});

describe('mergeGlossaries', () => {
  it('lets earlier sources win and removes clashing aliases', () => {
    const merged = mergeGlossaries(
      [{ id: 'core', term: 'dropout', short: 'x' }],
      [
        { id: 'a', term: 'Dropout', short: 'dup' },
        { id: 'b', term: 'bagging', aliases: ['dropout', 'bootstrap aggregating'], short: 'y' },
      ],
    );
    expect(merged.map((e) => [e.id, e.aliases])).toEqual([
      ['core', undefined],
      ['b', ['bootstrap aggregating']],
    ]);
  });
});
