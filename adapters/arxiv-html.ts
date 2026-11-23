// Symbol extraction from pages whose formulas are real Presentation MathML.
// A SiteProfile says where formulas, prose and sections live on a given site.

import { findDefinitions, placeholder, type SentenceMath } from '../core/definitions';
import { symbolsIn } from '../core/symbol-key';
import type { Occurrence } from '../core/symbol-table';

export interface SiteProfile {
  /** Rendered MathML formulas to index. */
  math: string;
  /** Prose blocks scanned for definitions and AI/ML terms. */
  prose: string;
  /** The formula's LaTeX source (shown in definition sentences, used for "N = 6" detection). */
  tex: (math: Element) => string;
  /** Subtrees that are not visible prose or formulas (e.g. accessibility copies of rendered maths). */
  hidden?: string;
}

/** arXiv HTML / ar5iv (LaTeXML): <math class="ltx_Math" alttext="d_{k}">, .ltx_p paragraphs, <section id="S3">. */
export const LATEXML: SiteProfile = {
  math: 'math.ltx_Math',
  prose: '.ltx_p, .ltx_caption',
  tex: (math) => math.getAttribute('alttext') ?? math.textContent ?? '',
};

/** Wikipedia (Parsoid): <math class="mwe-math-element" data-mw='{"body":{"extsrc":"…"}}'>. */
export const WIKIPEDIA: SiteProfile = {
  math: 'math.mwe-math-element',
  // Citation markers like "[8]" and inline styles are not prose.
  hidden: 'sup.reference, .mw-ref, style',
  prose: '.mw-parser-output :is(p, li, dd, figcaption)',
  tex: (math) => {
    try {
      return (JSON.parse(math.getAttribute('data-mw') ?? '{}') as { body?: { extsrc?: string } }).body?.extsrc ?? '';
    } catch {
      return math.textContent ?? '';
    }
  },
};

/**
 * Any other page: visible native MathML only. KaTeX and MathJax keep their MathML
 * in visually hidden copies, so their formulas get no symbol popups (terms still work).
 */
export const GENERIC: SiteProfile = {
  math: 'math',
  hidden: '.katex-mathml, mjx-assistive-mml, .MJX_Assistive_MathML, script, style',
  prose: ':is(article, main, [role=main], .markdown-body, body) :is(p, li, dd, figcaption, blockquote)',
  tex: (math) => math.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? math.getAttribute('alttext') ?? '',
};

const SKIP_IN_PROSE = new Set(['annotation', 'annotation-xml']);
// Sentence ends that are really abbreviations: "et al.", "e.g.", "Fig. 2".
const ABBREVIATION = /\b(?:e\.g|i\.e|et al|cf|vs|resp|approx|Fig|Figs|Eq|Eqs|Sec|Tab|No)\.$/i;

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
function readParagraph(p: Element, { math: mathSelector, hidden }: SiteProfile): Paragraph {
  const maths: Element[] = [];
  let text = '';
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) text += child.textContent ?? '';
      else if (child.nodeType === 1) {
        const el = child as Element;
        if (el.matches(mathSelector)) {
          text += placeholder(maths.length);
          maths.push(el);
        } else if (!SKIP_IN_PROSE.has(el.localName) && !(hidden && el.matches(hidden))) walk(el);
      }
    }
  };
  walk(p);
  // Wikipedia wraps inline maths in U+2060 word joiners; they must not become "words".
  return { text: text.replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' '), maths };
}

export function extractOccurrences(doc: Document, profile: SiteProfile = LATEXML): Occurrence[] {
  const { tex } = profile;
  const occurrences: Occurrence[] = [];
  const firstOfMath = new Map<Element, Occurrence>();

  const visible = (el: Element): boolean => !profile.hidden || !el.closest(profile.hidden);
  Array.from(doc.querySelectorAll(profile.math)).filter(visible).forEach((math, mathIndex) => {
    const mathId = math.id || `math-${mathIndex}`;
    const sectionId = math.closest('section')?.id ?? null;
    for (const { el, key } of symbolsIn(math)) {
      const occ: Occurrence = { key, order: occurrences.length, mathId, sectionId, el };
      occurrences.push(occ);
      if (!firstOfMath.has(math)) firstOfMath.set(math, occ);
    }
  });

  // Nested matches (an <li> inside a <blockquote>) would read the same text twice.
  const blocks = Array.from(doc.querySelectorAll(profile.prose)).filter((b) => !b.parentElement?.closest(profile.prose));
  for (const p of blocks) {
    const { text, maths } = readParagraph(p, profile);
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
