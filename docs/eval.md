# Definition detection on SymDef

PaperPeek finds symbol definitions with deterministic patterns (`core/definitions.ts`). There is no model involved. This page measures how well those patterns do on **SymDef**: the test split of Martin-Boyle et al., *Complex Mathematical Symbol Definition Structures* (2023). The split has 1,442 symbol mentions from 21 ML papers, and 253 of them are defined in their own sentence.

Reproduce with `pnpm eval:symdef`. The script downloads the split at run time; the dataset repository has no license, so the data is not copied into this repo.

## Method

- Each SymDef sentence is rebuilt with `§i§` placeholders for its symbols, exactly as the page adapters build them.
- `findDefinitions` then runs on it.
- **Detection:** does PaperPeek report a definition for the target symbol, counting only results at or above the confidence threshold?
- **Gloss token F1:** for correct detections, word overlap between PaperPeek's gloss and the annotated definition span.

## Results

| Confidence ≥ | Precision | Recall | F1 | Gloss token F1 | TP / FP / FN |
|---|---|---|---|---|---|
| 0.9 (strong patterns) | 88.2% | 11.9% | 20.9% | 81.4% | 30 / 4 / 223 |
| 0.7 (trusted) | 87.8% | 14.2% | 24.5% | 81.8% | 36 / 5 / 217 |
| 0.5 (+ noun phrase before the symbol) | 57.3% | 69.6% | 62.9% | 84.7% | 176 / 131 / 77 |
| 0.4 (+ "N examples" counts) | 56.3% | 70.8% | 62.7% | 84.1% | 179 / 139 / 74 |

### Baseline before tuning

Before using this evaluation, the scores were:
- **≥ 0.7:** P 81.5%, R 8.7%, F1 15.7%.
- **≥ 0.5:** P 55.3%, R 64.0%, F1 59.3%.

Three changes came from reading the misses:
- **"Where" lists:** later items of a list such as "…, *V* is the vocabulary size" now match.
- **Coordinated symbols:** in "where *a*, *b*, and *c* are trainable parameters", all three symbols get the gloss.
- **Counts:** a symbol before a plural noun ("a mini-batch of *m* examples") is read as a count. This is a low-confidence guess, used only when nothing better exists.

## How to read this

- **Trusted definitions are precise.** When the popup presents a definition as trusted, about 88% of the time it is one annotators also marked. Its wording matches the annotated span at about 82% token F1.
- **Recall comes from the weaker noun-phrase rule.** That rule is right a little over half the time. This is why every popup quotes the source sentence and links to it: the reader can always check.
- **Some misses are out of reach for patterns.** Examples:
  - "respectively" constructions;
  - definitions split across sentences;
  - symbols defined inside display equations.

  TaDDEx, the model released with SymDef, handles these better. It needs a GPU-class model, which PaperPeek avoids by design.

### "Respectively" lists

PaperPeek now pairs "*a* and *b* are the input and output, respectively" one to one, giving *a* the gloss "input" and *b* the gloss "output". It only does this when the two lists have the same length. The SymDef scores above are unchanged: just 10 defined mentions in the test split sit in "respectively" sentences, and none of them has this shape.

A reversed form, "the A and the B are *p* and *q*, respectively", was tried and removed. It added two false positives and no true positives, because SymDef's annotators do not count that phrasing as a definition.
