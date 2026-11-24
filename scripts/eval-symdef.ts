// `pnpm eval:symdef`: downloads the SymDef test split (not redistributed here:
// the dataset repository has no license) and prints a Markdown results table.

import { predict, score, type SymDefRow } from './symdef.ts';

const URL_TEST = 'https://raw.githubusercontent.com/minnesotanlp/taddex/main/data_files/SymDef/test.json';

const res = await fetch(URL_TEST);
if (!res.ok) throw new Error(`${URL_TEST} → ${res.status}`);
const rows = (await res.json()) as SymDefRow[];
const predictions = rows.map(predict);
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;

console.log(`SymDef test split: ${rows.length} symbol mentions, ${predictions.filter((p) => p.gold).length} with a definition in the sentence.\n`);
console.log('| Confidence ≥ | Precision | Recall | F1 | Gloss token F1 (true positives) | TP / FP / FN |');
console.log('|---|---|---|---|---|---|');
for (const threshold of [0.9, 0.7, 0.5, 0.4]) {
  const s = score(predictions, threshold);
  console.log(`| ${threshold} | ${pct(s.precision)} | ${pct(s.recall)} | ${pct(s.f1)} | ${pct(s.spanF1)} | ${s.tp} / ${s.fp} / ${s.fn} |`);
}
