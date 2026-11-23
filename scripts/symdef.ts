// Scores the deterministic definition detector (core/definitions.ts) on the
// SymDef test split (Martin-Boyle et al., 2023: 21 ML papers, every symbol
// mention annotated with its definition span). Pure; scripts/eval-symdef.ts runs it.

import { findDefinitions, placeholder, type SentenceMath } from '../core/definitions.ts';

/** One SymDef row: a sentence with the target symbol wrapped as "</s> SYMBOL </s>". */
export interface SymDefRow {
  tokens: string[];
  labels: string[];
  symbols: string[];
  label: 'definition' | 'none';
}

export interface Prediction {
  gold: boolean;
  goldDef: string[];
  predicted: { gloss: string; confidence: number } | null;
}

const ASSIGNMENT = /^[^=]+=\s*[\d.,]+\s*$/;

/** Rebuild the sentence with §i§ placeholders, as the page adapters do, and predict for the target symbol. */
export function predict(row: SymDefRow): Prediction {
  const words: string[] = [];
  const goldDef: string[] = [];
  let symbol = 0;
  let target = -1;
  for (let i = 0; i < row.tokens.length; i++) {
    const tok = row.tokens[i]!;
    if (tok === '</s>') continue;
    if (/DEF$/.test(row.labels[i] ?? '')) goldDef.push(tok.toLowerCase());
    if (tok === 'SYMBOL') {
      if (row.tokens[i - 1] === '</s>' && row.tokens[i + 1] === '</s>') target = symbol;
      words.push(placeholder(symbol++));
    } else {
      words.push(tok);
    }
  }
  const text = words.join(' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(');
  const maths: SentenceMath[] = Array.from({ length: symbol }, (_, i) => {
    const tex = (row.symbols[i] ?? '').replace(/^\[\[\s*|\s*\]\]$/g, '');
    return { id: `m${i}`, keys: [`s${i}`], assigns: ASSIGNMENT.test(tex) };
  });
  const def = findDefinitions({ text, maths }).find((d) => d.mathId === `m${target}`);
  return { gold: row.label === 'definition', goldDef, predicted: def ? { gloss: def.gloss, confidence: def.confidence } : null };
}

export interface Scores {
  threshold: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  /** Mean token F1 between predicted gloss and gold definition span, over true positives. */
  spanF1: number;
}

const f1 = (p: number, r: number): number => (p + r ? (2 * p * r) / (p + r) : 0);

function tokenF1(predicted: string, gold: readonly string[]): number {
  const pred = predicted.toLowerCase().split(/\s+/).filter(Boolean);
  if (!pred.length || !gold.length) return 0;
  const pool = [...gold];
  let hit = 0;
  for (const t of pred) {
    const at = pool.indexOf(t);
    if (at >= 0) {
      hit++;
      pool.splice(at, 1);
    }
  }
  return f1(hit / pred.length, hit / gold.length);
}

export function score(predictions: readonly Prediction[], threshold: number): Scores {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let span = 0;
  for (const p of predictions) {
    const said = p.predicted !== null && p.predicted.confidence >= threshold;
    if (said && p.gold) {
      tp++;
      span += tokenF1(p.predicted!.gloss, p.goldDef);
    } else if (said) fp++;
    else if (p.gold) fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { threshold, tp, fp, fn, precision, recall, f1: f1(precision, recall), spanF1: tp ? span / tp : 0 };
}
