# Complete report workflows

These fixed examples demonstrate authoring, a bounded edit and independent presentation changes. They use the project's documented contracts; they are not new research, a record of an Agent run or a token/performance comparison. Copy the whole `examples/` directory when using an installed package so the sibling `presentation/` manifests and styles remain available.

| Report                | Initial → edited input                                                                                        | Prescribed edit                                                                                                                                                                 | Configs                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Tool comparison       | [tools-initial.json](tools-initial.json) → [tools-edited.json](tools-edited.json)                             | Append Browser entry and change one conclusion run; preserve previous rows, field order, IDs, sources and other text.                                                           | [cards](tools-cards.json), [table](tools-table.json)                 |
| Technical guide       | [guide-initial.json](guide-initial.json) → [guide-edited.json](guide-edited.json)                             | Add `--theme midnight` to one command and update one nested checklist item. Preserve the separate literal sample, including CRLF, indentation, blank lines and `<tag> & value`. | [default](guide-default.json)                                        |
| Architecture grouping | [architecture-initial.json](architecture-initial.json) → [architecture-edited.json](architecture-edited.json) | Move the complete Theme subtree from presentation to delivery and rename its label. Retain descendants, other nodes and source references.                                      | [tree](architecture-tree.json), [mindmap](architecture-mindmap.json) |

The guide extends the [technical guide](../technical-guide.json) with a literal-code sample; architecture extends the [hierarchy example](../hierarchy.json) with a long Chinese label. Tool-entry facts come from the [CLI](../../docs/cli-cookbook.md), [architecture](../../docs/architecture.md) and [Plugin](../../docs/plugin-authoring.md) contracts. Sources are block-level references, not per-cell verification. [cases.json](cases.json) indexes these fixed tasks for tests; it is neither a semantic report nor a presentation config.

## Build and edit

Run from a built checkout root. The config registers external paper/night Themes and the right-side TOC Layout, selects paper/right-side TOC and enables offline comparison switching. Guide/tree blocks remain static; selected mindmaps have their own node folding. For installed local archives, replace `node dist/cli/main.js` with `npx --no-install semloom` after following the [installation guide](../../docs/releases.md#project-local-package).

```sh
mkdir -p reports/workflows
node dist/cli/main.js schema --config examples/report-workflows/tools-cards.json > reports/workflows/schema.json
node dist/cli/main.js validate examples/report-workflows/tools-initial.json --config examples/report-workflows/tools-cards.json
node dist/cli/main.js build examples/report-workflows/tools-initial.json --config examples/report-workflows/tools-cards.json -o reports/workflows/tools-initial.html --explain
node dist/cli/main.js validate examples/report-workflows/tools-edited.json --config examples/report-workflows/tools-cards.json
node dist/cli/main.js build examples/report-workflows/tools-edited.json --config examples/report-workflows/tools-cards.json --theme example.night -o reports/workflows/tools-edited.html --explain
node dist/cli/main.js build examples/report-workflows/tools-edited.json --config examples/report-workflows/tools-table.json --theme example.night -o reports/workflows/tools-table.html --explain
```

The edited report keeps the requested cards Variant; the separate table build explicitly selects another Variant. `--explain` writes the actual initial Plan to stderr, followed by the build notice. Browser switching does not rewrite that Plan or the input JSON.

```sh
node dist/cli/main.js validate examples/report-workflows/guide-initial.json --config examples/report-workflows/guide-default.json
node dist/cli/main.js build examples/report-workflows/guide-initial.json --config examples/report-workflows/guide-default.json -o reports/workflows/guide-initial.html --explain
node dist/cli/main.js validate examples/report-workflows/guide-edited.json --config examples/report-workflows/guide-default.json
node dist/cli/main.js build examples/report-workflows/guide-edited.json --config examples/report-workflows/guide-default.json --theme example.night --layout document -o reports/workflows/guide-edited.html --explain
```

Changing the report's Theme/Layout above is independent of the command text inside its code block. That command text remains literal report content and is never executed by the compiler.

```sh
node dist/cli/main.js validate examples/report-workflows/architecture-initial.json --config examples/report-workflows/architecture-tree.json
node dist/cli/main.js build examples/report-workflows/architecture-initial.json --config examples/report-workflows/architecture-tree.json -o reports/workflows/architecture-tree-initial.html --explain
node dist/cli/main.js build examples/report-workflows/architecture-initial.json --config examples/report-workflows/architecture-mindmap.json -o reports/workflows/architecture-mindmap-initial.html --explain
node dist/cli/main.js validate examples/report-workflows/architecture-edited.json --config examples/report-workflows/architecture-mindmap.json
node dist/cli/main.js build examples/report-workflows/architecture-edited.json --config examples/report-workflows/architecture-tree.json --theme example.night -o reports/workflows/architecture-tree-edited.html --explain
node dist/cli/main.js build examples/report-workflows/architecture-edited.json --config examples/report-workflows/architecture-mindmap.json --theme example.night -o reports/workflows/architecture-mindmap-edited.html --explain
```

Change semantic JSON/config and rebuild; do not patch generated HTML. Check comparison order and values, inline formatting/links, exact code text and the moved subtree. Read at 375px, disable JS and print: full content and sources remain available. Markmap stays graphical on narrow screens with local scrolling, while no-JS/failure/print use the complete tree. See [contracts](../../docs/semantic-schema.md), [external presentation](../../docs/presentation-authoring.md) and [evaluation limits](../../docs/evaluation.md).

## Repeat validation from a checkout

```sh
pnpm build
node --test tests/report-workflows.test.mjs
node scripts/playwright.mjs test tests/e2e/report-workflows.spec.ts
```

The Node test checks the exact edit boundaries, effective Schema, deterministic builds, unchanged data/selection across Theme/Layout combinations and CLI/Library equality. Chromium checks both tasks, four presentation combinations, desktop/375px, offline switching/folding, navigation, no-JS and print. These development tests are not shipped in the tarball; the complete inputs and configs are.
