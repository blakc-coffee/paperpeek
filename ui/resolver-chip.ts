// A small "Open in arXiv HTML" link for pages about an arXiv paper (abstract,
// Hugging Face Papers, alphaXiv), where symbols and figures can't be read.

import { arxivHtmlUrl } from '../core/resolver';

const STYLE = `
:host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
.chip {
  display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; border-radius: 999px;
  background: #ffffff; color: #111827; border: 1px solid rgb(0 0 0 / 0.08);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.12);
  font: 500 14px/20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .chip { background: #1f2430; color: #f3f4f6; border-color: rgb(255 255 255 / 0.10); }
}
a { color: inherit; text-decoration: none; }
a:hover { text-decoration: underline; }
button { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 999px; text-align: center; line-height: 28px; color: inherit; opacity: 0.6; }
button:hover { opacity: 1; }
a:focus-visible, button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
`;

export function showResolverChip(doc: Document, id: string): () => void {
  const host = doc.createElement('paperpeek-chip');
  const root = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  const chip = doc.createElement('div');
  chip.className = 'chip';
  const link = doc.createElement('a');
  link.href = arxivHtmlUrl(id);
  link.textContent = 'Read with PaperPeek (arXiv HTML) ↗';
  link.rel = 'noopener';
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', () => host.remove());
  chip.append(link, close);
  root.append(style, chip);
  doc.documentElement.appendChild(host);
  return () => host.remove();
}
