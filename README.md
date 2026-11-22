# MathLens

**Hover any symbol or ML term in a paper and see what it means — where it was defined, with diagrams, the paper's own figures, and small interactive demos.**

Reading ML papers means constantly scrolling back to find where `𝓛`, `W^Q` or `λ` was introduced four pages ago, or googling "KL divergence" for the tenth time. MathLens is a browser extension that answers both in place:

- **Symbols** — hover `d_k` and see the sentence that defined it, the section it belongs to, and a link to jump there. When a symbol is redefined, you get the definition that applies *at your position* (nearest preceding definition).
- **AI/ML terms** — hover "multi-head attention" and get a short explanation, its formula, a diagram, and (for some terms) a mini demo such as a softmax-temperature slider.
- **Figures** — hover "Figure 2" and see the figure with its caption without losing your place.

## Principles

- **Local-first & private.** No account, no telemetry, no AI model, no server. The only network call is an opt-in Wikipedia lookup for unknown terms, which sends just the term.
- **Deterministic.** Definitions come from the paper itself and from a curated, licensed glossary — every popup shows its source.
- **Light.** Vanilla TypeScript, lazy-loaded popup, ~30 MB per tab budget. Runs only on sites you enable.

## Where it works

| Phase | Sites |
|---|---|
| 1 | arXiv HTML (`arxiv.org/html/…`), ar5iv |
| 2 | Wikipedia, GitHub READMEs, KaTeX / MathJax blogs, Hugging Face Papers, alphaXiv & OpenReview (via arXiv resolver) |
| Later (opt-in) | PDFs through a bundled pdf.js viewer |

## Status

🚧 **Planning stage — no code yet.** See [`docs/architecture.md`](docs/architecture.md) for the research, the architecture decision, and the milestone roadmap (v0.0 → v1.0).

## Roadmap

- [ ] v0.0 Repo foundation (docs, WXT scaffold, CI, release automation)
- [ ] v0.1 arXiv symbol table + definition detection
- [ ] v0.2 Hover popup
- [ ] v0.3 Figure previews
- [ ] v0.4 ML term glossary + highlighting
- [ ] v0.5 Interactive demos
- [ ] v0.6 Wikipedia fallback (opt-in)
- [ ] v0.7 Glossary build pipeline
- [ ] v0.8 Multi-site adapters
- [ ] v0.9 Evaluation on SymDef
- [ ] v1.0 Chrome Web Store + Firefox Add-ons release

## Prior art

MathLens builds on ideas from [ScholarPhi](https://arxiv.org/abs/2009.14237) (Head et al., CHI 2021), which showed position-sensitive symbol definitions were the most-used reading aid in its user study.

## License

Code: [MIT](LICENSE). Bundled glossary data carries per-source licenses under `data/` (added in later milestones).
