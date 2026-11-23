# Store listing

Copy for the Chrome Web Store and Firefox Add-ons (AMO). The screenshots in `store/screenshots/` are 1280×800 PNGs, the size the Chrome Web Store requires. They were rendered from the live arXiv page with the real popup code.

## Name

PaperPeek

## Summary (≤ 132 characters)

Hover symbols, AI/ML terms and figures in research papers to see definitions, diagrams and demos, right where you read.

## Description

Reading ML papers means scrolling back to find where a symbol was introduced, or searching "KL divergence" for the tenth time. PaperPeek answers in place.

• Symbols: hover d_k and see the sentence that defined it, its section, and a link to jump there. When a symbol is redefined, you get the definition that applies at your position.
• AI/ML terms: key terms are softly underlined. Hover one for a plain explanation, its formula and a diagram.
• Try it: softmax temperature, activation functions, attention weights, gradient descent and dropout each have a small interactive demo.
• Figures and tables: hover "Figure 2" to preview it with its caption.
• Look anything up: select a phrase to check the bundled glossary of 459 terms, with an optional Wikipedia lookup for anything else.

Works on arXiv HTML papers out of the box. Turn it on for Wikipedia, blogs or any other site with one click on the toolbar button.

Private by design: no account, no tracking, no server, no AI model. Everything runs in your browser. The only network request is the optional Wikipedia lookup, which sends just the selected term.

Open source: https://github.com/blakc-coffee/paperpeek

## Category

Chrome: Education (Productivity is the second choice). AMO: Education & Reference.

## Single purpose (Chrome)

Explain the symbols, technical terms and figures of the page the user is reading, in a popup on that page.

## Permission justifications (Chrome)

| Permission | Justification |
|---|---|
| `storage` | Saves the user's Wikipedia lookup setting and caches up to 200 lookup results for 7 days. |
| `activeTab` | Lets the toolbar popup read the current tab's address, so it can offer to enable PaperPeek on that site. |
| `scripting` | Registers the content script for sites the user has enabled, and runs it in the open tab right after the user enables it. |
| Optional host permissions (`https://*/*`, `http://*/*`) | Requested for one site at a time, only when the user clicks "Enable on this site". Never granted at install. |
| Host access to arxiv.org | The extension's main use: explaining arXiv HTML papers. |

Remote code: none. All code ships in the package.

## Data usage disclosures (Chrome)

- Collects: nothing.
- Wikipedia: if the user allows it, the selected term is sent to en.wikipedia.org to fetch a summary. This is user-initiated, for the extension's single purpose, and not sold or transferred.
- Certify: no sale of data, no use unrelated to the single purpose, no creditworthiness use.

## Firefox data collection

`data_collection_permissions.required: ["none"]` holds, because the extension itself collects and transmits nothing about the user. The optional, user-triggered Wikipedia lookup sends a selected term to a third party. If AMO review asks, declare it as optional `searchTerms` and gate the lookup on that permission.

## Links

- Homepage: https://blakc-coffee.github.io/paperpeek/
- Privacy policy: https://blakc-coffee.github.io/paperpeek/privacy.html
- Support: https://github.com/blakc-coffee/paperpeek/issues

## Submitting

1. Each GitHub release attaches `paperpeek-<version>-chrome.zip` and `paperpeek-<version>-firefox.zip`.
2. Chrome: in the developer dashboard, create a new item, upload the Chrome zip, and paste the fields above.
   - Add the five screenshots and the 128 px icon (`public/icon/128.png`).
3. Firefox: on addons.mozilla.org, submit a new add-on and upload the Firefox zip.
   - AMO may ask for the source zip (`pnpm zip:firefox` makes one), because the code is bundled.
