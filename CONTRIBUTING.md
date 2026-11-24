# Contributing to PaperPeek

Thanks for helping. PaperPeek is a small, dependency-light browser extension, so most changes are quick to review.

## Setup

```sh
pnpm install
pnpm dev            # Chrome with hot reload
pnpm dev:firefox    # Firefox
```

## Checks

| Command | What it checks |
|---|---|
| `pnpm typecheck` | TypeScript |
| `pnpm test` | Unit tests (Vitest + happy-dom) |
| `pnpm build && pnpm build:firefox && pnpm lint:ext` | Both builds and the Mozilla linter |
| `pnpm e2e` | Loads the built extension in headless Chrome and checks it on a real arXiv paper. Needs Google Chrome; set `CHROME_PATH` if it isn't in the default location. |
| `pnpm eval:symdef` | Definition-detection accuracy on the SymDef test split |

CI runs the first three on every pull request.

## Guidelines

- **No runtime dependencies.** The popup uses plain DOM APIs in a closed shadow root. Add a library only when the platform can't do the job.
- **Nothing leaves the browser by default.** No telemetry, no servers. The only network request is the opt-in Wikipedia lookup.
- **Definition rules are measured.** If you change `core/definitions.ts`, run `pnpm eval:symdef` before and after, and record the numbers in `docs/eval.md`. Rules that don't improve SymDef are removed.
- **Glossary entries carry their license.** New hand-written terms go in `data/glossary/core.json`, under CC BY 4.0.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, …), which release-please uses for versions and the changelog.
