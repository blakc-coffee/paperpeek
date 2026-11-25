# Changelog

## 1.0.0 (2026-11-24)


### Features

* AI/ML term glossary with highlighting and explanation popups ([#11](https://github.com/blakc-coffee/paperpeek/issues/11)) ([b65a8c0](https://github.com/blakc-coffee/paperpeek/commit/b65a8c034dbade506d3621da9822a636a697df0b))
* build a position-aware symbol table from arXiv HTML ([#8](https://github.com/blakc-coffee/paperpeek/issues/8)) ([fde1993](https://github.com/blakc-coffee/paperpeek/commit/fde1993d1e2948be18f17eec78f87b31d553d1f9))
* **core:** detect symbol definitions in prose ([#7](https://github.com/blakc-coffee/paperpeek/issues/7)) ([59269e9](https://github.com/blakc-coffee/paperpeek/commit/59269e9258cb81ac045783227318c5c696a92343))
* **core:** extract symbol keys from Presentation MathML ([#5](https://github.com/blakc-coffee/paperpeek/issues/5)) ([c8767f3](https://github.com/blakc-coffee/paperpeek/commit/c8767f312657028998d1420cc755c22ab53f5934))
* **data:** 24 more terms, quantifier-free glosses, three new diagrams ([#23](https://github.com/blakc-coffee/paperpeek/issues/23)) ([64f1832](https://github.com/blakc-coffee/paperpeek/commit/64f1832806e478bac7c3e664bbdb61505cb7a265))
* **data:** build-time glossary pipeline from ADictML and Wikidata ([#14](https://github.com/blakc-coffee/paperpeek/issues/14)) ([572624b](https://github.com/blakc-coffee/paperpeek/commit/572624be92726ea5994d1199e5cf66e640c2fefe))
* **eval:** measure definition detection on SymDef and tune patterns from it ([#17](https://github.com/blakc-coffee/paperpeek/issues/17)) ([1ee786e](https://github.com/blakc-coffee/paperpeek/commit/1ee786e06240e857d6e8959499b77f8f89aceea9))
* **firefox:** ask for searchTerms consent before Wikipedia lookups ([#27](https://github.com/blakc-coffee/paperpeek/issues/27)) ([720698e](https://github.com/blakc-coffee/paperpeek/commit/720698ecffb02ce1350472db2f44f2d589eb7ffd))
* first-run welcome page and a "Report a wrong definition" link ([#32](https://github.com/blakc-coffee/paperpeek/issues/32)) ([6e41b20](https://github.com/blakc-coffee/paperpeek/commit/6e41b20c458e40249c5dc4eee67cad87bba8a4d0))
* formula cards for KaTeX and MathJax pages ([#21](https://github.com/blakc-coffee/paperpeek/issues/21)) ([542f07f](https://github.com/blakc-coffee/paperpeek/commit/542f07f8cd0e769997c77cf444d05376f48962cf))
* opt-in Wikipedia lookup for selected terms outside the glossary ([#13](https://github.com/blakc-coffee/paperpeek/issues/13)) ([75e86a7](https://github.com/blakc-coffee/paperpeek/commit/75e86a74f0d0af077c1c94160ea10c04e6a3c3c8))
* pair "respectively" lists; document per-tab memory and setup time ([#19](https://github.com/blakc-coffee/paperpeek/issues/19)) ([4334072](https://github.com/blakc-coffee/paperpeek/commit/433407216189de0920a1d4138b08da23541ef476))
* run on any site the reader enables (v0.8) ([#16](https://github.com/blakc-coffee/paperpeek/issues/16)) ([661ba49](https://github.com/blakc-coffee/paperpeek/commit/661ba499a5de3977995cc153a2569a7142a9440d))
* store-ready release with icons, landing page and privacy policy (v1.0) ([#18](https://github.com/blakc-coffee/paperpeek/issues/18)) ([b3cb053](https://github.com/blakc-coffee/paperpeek/commit/b3cb05322db261311debb8acaaa41e122a32b174))
* symbol glossary side panel ([#31](https://github.com/blakc-coffee/paperpeek/issues/31)) ([ac27df0](https://github.com/blakc-coffee/paperpeek/commit/ac27df0eebfe0cff07a57d4ce28d80476e780fae))
* tested site sync and an enabled-sites list in options ([#22](https://github.com/blakc-coffee/paperpeek/issues/22)) ([3121f51](https://github.com/blakc-coffee/paperpeek/commit/3121f514d6a0296c44e0a197db01504c6c77fc24))
* **ui:** "Show all uses" highlights every occurrence of a symbol ([#30](https://github.com/blakc-coffee/paperpeek/issues/30)) ([f529989](https://github.com/blakc-coffee/paperpeek/commit/f529989dff9da159f961d705fc26892da88e42d8))
* **ui:** equation and citation previews on reference hover ([#29](https://github.com/blakc-coffee/paperpeek/issues/29)) ([3c9fc67](https://github.com/blakc-coffee/paperpeek/commit/3c9fc67a8d6f5cf162ade5eceac2b534d9197aec))
* **ui:** hover popup with definition, source sentence, and jump ([#9](https://github.com/blakc-coffee/paperpeek/issues/9)) ([5c57243](https://github.com/blakc-coffee/paperpeek/commit/5c5724331a0d2790a3b5007ab0b135b60d663515))
* **ui:** interactive demos behind "Try it" in term popups ([#12](https://github.com/blakc-coffee/paperpeek/issues/12)) ([f7134dd](https://github.com/blakc-coffee/paperpeek/commit/f7134dd27fe710aedc0cc1e8edc3649274df92c5))
* **ui:** keyboard selection lookups and Alt+Shift+P ([#20](https://github.com/blakc-coffee/paperpeek/issues/20)) ([c4bb920](https://github.com/blakc-coffee/paperpeek/commit/c4bb9204ed3800a7e0174f7852f4b61b201e02c0))
* **ui:** move focus into keyboard-opened popups, return it on Esc ([#26](https://github.com/blakc-coffee/paperpeek/issues/26)) ([2c4ac5a](https://github.com/blakc-coffee/paperpeek/commit/2c4ac5a6c5226ccb278a6da9e15c638f3788e674))
* **ui:** preview figures and tables on reference hover ([#10](https://github.com/blakc-coffee/paperpeek/issues/10)) ([4b9b4cd](https://github.com/blakc-coffee/paperpeek/commit/4b9b4cd7c015a7aebc0a298a4eaa913f25dc4388))
* **ui:** sampling demo with temperature, top-k and top-p sliders ([#25](https://github.com/blakc-coffee/paperpeek/issues/25)) ([9397215](https://github.com/blakc-coffee/paperpeek/commit/9397215ce51b192fa38d2ee61c43cef1da41f746))
