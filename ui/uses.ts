// "Show all uses": paints every occurrence of one symbol with a second CSS
// Custom Highlight, so the reader can scroll and see where it appears. Like the
// term underline, it never changes the page's DOM.

const USES = 'paperpeek-uses';

/** Highlight these elements (symbol occurrences, or whole KaTeX/MathJax formulas). Returns how many. */
export function showUses(doc: Document, elements: readonly Element[]): number {
  if (typeof Highlight === 'undefined' || !('highlights' in CSS)) return 0;
  const ranges = elements.map((element) => {
    const range = doc.createRange();
    range.selectNode(element);
    return range;
  });
  CSS.highlights.set(USES, new Highlight(...ranges));
  return ranges.length;
}

/** Remove the "all uses" highlight, if any. */
export function clearUses(): void {
  if ('highlights' in CSS) CSS.highlights.delete(USES);
}

/** Stylesheet rule for the highlight; added to the page alongside the term underline. */
export const USES_STYLE = `::highlight(${USES}) { background-color: rgb(245 158 11 / 0.38); }`;
