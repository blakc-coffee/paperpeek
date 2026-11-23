// arXiv HTML / ar5iv (LaTeXML output). Each formula is
// <math class="ltx_Math" id="S3.p1.m2" alttext="d_{k}"> with Presentation MathML
// inside; prose lives in .ltx_p paragraphs inside <section id="S3"> elements.

import { findDefinitions, placeholder, type SentenceMath } from '../core/definitions';
import { symbolsIn } from '../core/symbol-key';
import type { Occurrence } from '../core/symbol-table';

const MATH = 'math.ltx_Math';
const SKIP_IN_PROSE = new Set(['annotation', 'annotation-xml']);
// Sentence ends that are really abbreviations: "et al.", "e.g.", "Fig. 2".
const ABBREVIATION = /\b(?:e\.g|i\.e|et al|cf|vs|resp|approx|Fig|Figs|Eq|Eqs|Sec|Tab|No)\.$/i;

const tex = (math: Element): string => math.getAttribute('alttext') ?? math.textContent ?? '';
// "N=6", "h = 8", "d_{\text{model}}=512": the formula gives the symbol a value.
const ASSIGNMENT = /^[^=]+=\s*[\d.,]+\s*$/;

/** "Sublayer(x) is the function …" defines Sublayer, not x. */
function startsWithFunction(math: Element): boolean {
  const firstMi = math.querySelector('mi');
  return [...(firstMi?.textContent ?? '').trim()].length > 1;
}

/** Split prose into sentences, keeping abbreviations attached. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(?<=[.!?])\s+(?=[A-Z§(\[])/)) {
    const prev = out.at(-1);
    if (prev !== undefined && ABBREVIATION.test(prev)) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

/** "a §0§ b" → ["a ", <math>, " b"] using the paragraph's formulas. */
function toParts(sentence: string, maths: Element[]): Array<string | Element> {
  return sentence
    .split(/(§\d+§)/)
    .filter(Boolean)
    .map((piece) => {
      const m = /^§(\d+)§$/.exec(piece);
      return m ? (maths[Number(m[1])] ?? piece) : piece;
    });
}

interface Paragraph {
  text: string;
  maths: Element[];
}

/** Flatten a paragraph to text with §i§ placeholders for each inline formula. */
function readParagraph(p: Element): Paragraph {
  const maths: Element[] = [];
  let text = '';
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) text += child.textContent ?? '';
      else if (child.nodeType === 1) {
        const el = child as Element;
        if (el.matches(MATH)) {
          text += placeholder(maths.length);
          maths.push(el);
        } else if (!SKIP_IN_PROSE.has(el.localName)) walk(el);
      }
    }
  };
  walk(p);
  return { text: text.replace(/\s+/g, ' '), maths };
}

export function extractOccurrences(doc: Document): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const firstOfMath = new Map<Element, Occurrence>();

  Array.from(doc.querySelectorAll(MATH)).forEach((math, mathIndex) => {
    const mathId = math.id || `math-${mathIndex}`;
    const sectionId = math.closest('section')?.id ?? null;
    for (const { el, key } of symbolsIn(math)) {
      const occ: Occurrence = { key, order: occurrences.length, mathId, sectionId, el };
      occurrences.push(occ);
      if (!firstOfMath.has(math)) firstOfMath.set(math, occ);
    }
  });

  for (const p of Array.from(doc.querySelectorAll('.ltx_p'))) {
    const { text, maths } = readParagraph(p);
    if (!maths.length) continue;
    const sentenceMaths: SentenceMath[] = maths.map((m) => {
      const first = firstOfMath.get(m);
      return {
        id: first?.mathId ?? '',
        keys: first && !startsWithFunction(m) ? [first.key] : [],
        assigns: ASSIGNMENT.test(tex(m)),
      };
    });
    for (const sentence of splitSentences(text)) {
      for (const def of findDefinitions({ text: sentence, maths: sentenceMaths })) {
        const index = sentenceMaths.findIndex((m) => m.id === def.mathId);
        const occ = firstOfMath.get(maths[index]!);
        if (!occ || (occ.definition && occ.definition.confidence >= def.confidence)) continue;
        occ.definition = {
          gloss: def.gloss,
          confidence: def.confidence,
          sentence: sentence.replace(/§(\d+)§/g, (_, i: string) => `$${tex(maths[Number(i)]!)}$`),
          parts: toParts(sentence, maths),
        };
      }
    }
  }
  return occurrences;
}
