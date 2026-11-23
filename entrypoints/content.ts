// Phase 1 target: arXiv HTML (LaTeXML output). Each formula is
// <math class="ltx_Math" alttext="..."> with an application/x-tex annotation.
// For now the script only reports what it found, proving injection works;
// symbol extraction lands in v0.1.
export default defineContentScript({
  matches: ['https://arxiv.org/html/*', 'https://ar5iv.labs.arxiv.org/html/*'],
  runAt: 'document_idle',
  main() {
    const formulas = document.querySelectorAll('math.ltx_Math').length;
    const figures = document.querySelectorAll('figure.ltx_figure').length;
    console.info(`[MathLens] ${formulas} formulas, ${figures} figures on this page`);
  },
});
