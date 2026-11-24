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
• Try it: softmax temperature, activation functions, attention weights, gradient descent, dropout and next-token sampling each have a small interactive demo.
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
- Wikipedia: if the user allows it, the selected term is sent to en.wikipedia.org to fetch a summary (on Firefox, after the built-in `searchTerms` consent). This is user-initiated, for the extension's single purpose, and not sold or transferred.
- Certify: no sale of data, no use unrelated to the single purpose, no creditworthiness use.

## Firefox data collection

The Firefox manifest declares:

```json
"data_collection_permissions": { "required": ["none"], "optional": ["searchTerms"] }
```

- `required: ["none"]`: the extension itself collects and transmits nothing about the user.
- `optional: ["searchTerms"]`: the Wikipedia lookup sends the term the user selected to en.wikipedia.org. Firefox's built-in consent covers this.
- At runtime, the lookup is gated on the grant. Before the first lookup, the popup says Firefox asks first and offers "Allow in settings". The options page then calls `permissions.request({ data_collection: ["searchTerms"] })` inside the click (or radio change) handler, as MDN requires a user action. Content scripts ask the background, which checks with `permissions.contains`.
- Without the grant, no term is sent. "Never" needs no grant. Chrome ignores `browser_specific_settings` and has no consent step, so its build behaves as before.
- Source: MDN `manifest.json/browser_specific_settings` (`data_collection_permissions`), `permissions.request`, `permissions.Permissions` (`data_collection`) and `permissions.contains`. MDN shows `data_collection` in a `contains` example but not in a `request` example, and its pages do not state a minimum Firefox version. Check the grant flow by hand in a current Firefox before submitting.

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

### Later versions: the "Submit to stores" workflow

The first submission is manual because the store items must exist first. After that, run **Actions → Submit to stores** (`.github/workflows/submit.yml`):

1. Add the repository secrets:
   - Chrome Web Store API v2: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_EMAIL`, `CHROME_SERVICE_ACCOUNT_KEY`.
   - Firefox (AMO API key): `FIREFOX_EXTENSION_ID`, `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`.
2. Run it once with **dry run** ticked (the default). This only checks the credentials.
3. Run it again with dry run unticked. It tests and zips, then uploads to both stores and submits for review.
   - Chrome uses `STAGED_PUBLISH`, so after approval the update waits for you to press **Publish** in the dashboard.
   - Firefox is submitted to the listed channel, with the sources zip attached.
