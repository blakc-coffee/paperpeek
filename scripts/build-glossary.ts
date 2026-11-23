// Build-time glossary pipeline: Aalto Dictionary of ML (CC BY 4.0) + Wikidata (CC0)
// → data/glossary/generated.json. Runs monthly in CI (.github/workflows/glossary.yml)
// or locally with `pnpm glossary`. Prints JSON to stdout; no runtime network use.

import core from '../data/glossary/core.json' with { type: 'json' };
import { fromAdictml, fromWikidata, mergeGlossaries, type WikidataRow } from './glossary-sources.ts';

const UA = 'PaperPeek-glossary-builder (https://github.com/blakc-coffee/paperpeek)';
const ADICTML_RAW = 'https://raw.githubusercontent.com/AaltoDictionaryofML/AaltoDictionaryofML.github.io/main/';
const ADICTML_FILES = ['ADictML_CoreML.tex', 'ADictML_Math.tex', 'ADictML_MLSystems.tex', 'ADictML_RL.tex'];

// Concepts one hop (subclass of / instance of / part of) below these roots:
// machine learning, artificial neural network, deep learning, NLP, computer vision,
// supervised / unsupervised / reinforcement learning, classification, regression,
// activation function, loss function, transformer. People, software, companies,
// organizations and papers are excluded.
const SPARQL = `
SELECT ?item ?label ?desc ?article (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
  VALUES ?root { wd:Q2539 wd:Q192776 wd:Q197536 wd:Q30642 wd:Q844240 wd:Q334384 wd:Q1152135 wd:Q830687 wd:Q1744628 wd:Q208042 wd:Q4677469 wd:Q1036748 wd:Q85810444 }
  ?item wdt:P279|wdt:P31|wdt:P361 ?root .
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  ?item schema:description ?desc . FILTER(LANG(?desc) = "en")
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
  MINUS { ?item wdt:P31 ?t . VALUES ?t { wd:Q7397 wd:Q4830453 wd:Q43229 wd:Q341 wd:Q5 wd:Q13442814 wd:Q1331793 wd:Q506883 } }
} GROUP BY ?item ?label ?desc ?article`;

async function text(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

const tex = await Promise.all(ADICTML_FILES.map((f) => text(ADICTML_RAW + f, { headers: { 'User-Agent': UA } })));
const wikidata = JSON.parse(
  await text(`https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  }),
) as { results: { bindings: WikidataRow[] } };

const byTerm = (a: { term: string }, b: { term: string }): number => a.term.localeCompare(b.term, 'en');
const adictml = fromAdictml(tex).sort(byTerm);
const wd = fromWikidata(wikidata.results.bindings).sort(byTerm);
// Core entries win; generated ones only fill names nobody else has.
const merged = mergeGlossaries(core.entries, adictml, wd).slice(core.entries.length);

const lines = merged.map((e) => `    ${JSON.stringify(e)}`).join(',\n');
console.log(`{
  "generatedBy": "scripts/build-glossary.ts",
  "retrieved": "${new Date().toISOString().slice(0, 10)}",
  "sources": [
    { "name": "Aalto Dictionary of Machine Learning (ADictML), Alexander Jung and contributors", "url": "https://github.com/AaltoDictionaryofML/AaltoDictionaryofML.github.io", "license": "CC BY 4.0", "changes": "first sentence of each definition, LaTeX converted to plain text" },
    { "name": "Wikidata", "url": "https://www.wikidata.org/", "license": "CC0" }
  ],
  "entries": [
${lines}
  ]
}`);
