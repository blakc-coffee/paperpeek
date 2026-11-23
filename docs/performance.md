# Performance and memory

Measured on 24 Nov 2026 with headless Chrome (1280×800) on live pages. A harness loads the page, forces garbage collection three times, and reads `JSHeapUsedSize`. It then runs the same setup as `ui/start.ts` and measures again: symbol table, term index and highlights, the full lookup matcher (435 terms at the time), the popup, and the hover listeners. The difference is what PaperPeek adds.

| Page | Setup time | Symbols | Highlighted terms | JS heap added | DOM nodes added |
|---|---:|---:|---:|---:|---:|
| arXiv: *Attention Is All You Need* | 47 ms | 67 | 133 | 0.92 MB | 7 |
| Wikipedia: *Softmax function* | 50 ms | 84 | 26 | 0.89 MB | 7 |
| arXiv: *LoRA* (2106.09685) | 55 ms | 65 | 174 | 1.15 MB | 7 |

## What this covers

- **Heap:** the data structures PaperPeek builds, including symbol occurrences, term ranges, both compiled matchers and the popup.
  - The plan's budget is under 30 MB per tab; measured use is about 1 MB.
  - Not included: the extension's own script code (about 160 kB of source) and the fixed cost of the browser's isolated world for content scripts. Chrome's task manager shows those per extension, not per page.
- **DOM nodes:** only the popup's host element and its shadow content are added. Highlights use the CSS Custom Highlight API, so the page's text is never wrapped or changed.
- **Setup time:** includes compiling the matchers. Afterwards, hovering costs at most one hit-test per animation frame.

## Reproduce

The measurement scripts drive Chrome over the DevTools protocol (`Performance.getMetrics`, `HeapProfiler.collectGarbage`). They are not part of the build. To repeat the measurement, bundle the same calls as `ui/start.ts` into a page script and compare `JSHeapUsedSize` before and after, with garbage collection forced each time.
