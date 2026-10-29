# Coding Agent Guide

Semloom compiles semantic JSON into standalone, offline HTML reports. Use this file as a navigation guide; read the linked contracts when relevant to your task.

## Task index

| Task                                 | Read for details                                                                                                                                                | Source entry points                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Understand usage and setup           | [README](README.md): prerequisites, examples and public API.                                                                                                    | `package.json`, `examples/`                                        |
| Change compiler behavior             | [Architecture](docs/architecture.md): module boundaries, planning, determinism and trust.                                                                       | `src/index.ts`, `src/core/`                                        |
| Change content or validation         | [Semantic Schema](docs/semantic-schema.md): fields, limits, inline content and references.                                                                      | `src/core/schema.ts`, `src/core/document.ts`, `src/core/inline.ts` |
| Add kinds or Variants                | [Plugin authoring](docs/plugin-authoring.md): Registry, rendering and asset contracts.                                                                          | `src/core/registry.ts`, `src/plugins/`                             |
| Change appearance or page flow       | [Themes](docs/themes.md): tokens, responsive navigation and print. [External presentation](docs/presentation-authoring.md): Theme/Layout manifests and loading. | `src/html/`, `src/core/presentation.ts`, `src/presentation/`       |
| Change browser interaction           | [Interactive reports](docs/interactive.md): adapters, lifecycle and static fallback.                                                                            | `src/browser/`                                                     |
| Change CLI behavior                  | [CLI cookbook](docs/cli-cookbook.md): configuration, diagnostics and output.                                                                                    | `src/cli/main.ts`, `tests/cli.test.mjs`                            |
| Change packaging or exports          | [Package guide](docs/releases.md): archive contents, supported runtimes and installed-consumer checks.                                                          | `scripts/build.mjs`, `scripts/package-smoke.mjs`                   |
| Evaluate report quality              | [Evaluation](docs/evaluation.md): scenarios, measurements and evidence limits.                                                                                  | `tests/e2e/`, `benchmarks/`                                        |
| Change the report-authoring workflow | [Agent guide](docs/agent-guide.md): authoring and edit loop. [Bundled skill](skills/semloom/SKILL.md): report-generation instructions.                          | `examples/`, `skills/semloom/`                                     |

## Working conventions

- Inspect relevant code/tests and `git status --short` before editing. Preserve existing work and reuse local patterns; avoid unrelated refactors or formatting.
- Use toolchain versions from `package.json`. Follow strict TypeScript/ESM conventions, including `.js` relative imports. Edit source, not generated `dist/` files.
- Keep affected contracts, examples and usage docs synchronized, including both READMEs when shared usage changes. Link to existing documentation rather than duplicating it here.
- For tracked work, consult `_plans/index.md` and the relevant plan when present. Keep progress/evidence in those local ignored records; generated reports belong in `reports/`.
- Do not install global packages, change system settings, or publish/tag/create releases unless explicitly requested.

## Verification

- Build with `pnpm build` before checkout CLI use or focused tests. Run Node tests with `node --test tests/<name>.test.mjs`; browser tests with `node scripts/playwright.mjs test tests/e2e/<name>.spec.ts` to use the local browser cache.
- For implementation changes, start with focused tests, then run `pnpm check` (types, lint, formatting, Node and Chromium tests). Cover relevant rendering behavior using the [evaluation guide](docs/evaluation.md).
- For public API, CLI, loading or packaged-file changes, also run `pnpm test:package`; see the [package guide](docs/releases.md) for scope. Run `pnpm benchmark` when evaluating performance or scenario results.
- For documentation-only changes, verify formatting and links. Format only touched files with `pnpm exec prettier --write <files>`, review the diff and run `git diff --check`. Report actual checks and remaining gaps.
