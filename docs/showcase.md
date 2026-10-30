# Showcase recipes

These commands run from a source checkout after installation/build. For installed tarballs, use the [release guide](releases.md). Outputs are single HTML files under ignored `reports/showcase/`, opened directly with `file://`; no server or LLM key is required.

## Research comparison

```sh
pnpm semloom build examples/comparison.json --theme minimal --layout document -o reports/showcase/research.html --explain
pnpm semloom build examples/comparison.json --config examples/interactive.json -o reports/showcase/research-interactive.html --explain
```

The same documentation-backed JSON Schema/JTD data becomes a table selected by Auto. Theme/Layout config changes the reading surface; the interactive version lets a reader choose cards while retaining ordered fields, values and block-level source links. It does not re-run research or certify the report's conclusions.

## Complete initial/edit reports

The [workflow examples](../examples/report-workflows/README.md) provide three complete tasks: append a tool-entry comparison row and revise a Rich Text conclusion; change one guide command and nested checklist item; move and rename a complete architecture subtree. Each includes initial/edited JSON and external paper/night plus right-side TOC configs. Comparison cards/table and hierarchy tree/mindmap use explicit Overrides.

```sh
pnpm semloom build examples/report-workflows/tools-edited.json --config examples/report-workflows/tools-cards.json --theme example.night -o reports/showcase/tools-edited.html --explain
pnpm semloom build examples/report-workflows/guide-edited.json --config examples/report-workflows/guide-default.json --layout document -o reports/showcase/guide-edited.html --explain
pnpm semloom build examples/report-workflows/architecture-edited.json --config examples/report-workflows/architecture-mindmap.json --theme example.night -o reports/showcase/architecture-edited.html --explain
```

See the workflow guide for validation, both phases and alternate Variants. These are fixed capability examples, not independent Agent cost experiments. Check exact text, relationships, sources, narrow screens, no-JS and print after rebuilding from the inputs.

## PR handoff

```sh
pnpm semloom build examples/pr-daily.json --config examples/editorial-sidebar.json -o reports/showcase/pr-daily.html --explain
```

This explicitly illustrative report uses the six original kinds: context, a limitation, metrics, a PR comparison, next steps and a timeline. It shows what the next reader needs to check and which statements have sources. It is not connected to real GitHub/CI state, and the compiler does not derive performance or risk conclusions.

## Report authoring workflow

```sh
pnpm semloom validate examples/report-workflow.json --config examples/editorial-sidebar.json
pnpm semloom build examples/report-workflow.json --config examples/editorial-sidebar.json -o reports/report-workflow.html --explain
```

This process-explanation report describes source preparation, effective Schema, validation and rebuilding after edits. Its sources are the project's authoring, semantic-contract and installation guides. Stable section/block IDs and block citations demonstrate the data model. The document is portable across Themes/Layouts and does not record a specific machine, version or successful Agent run. The existing editorial/sidebar config supplies presentation; generated HTML stays under ignored `reports/`.

## Theme and Layout gallery

```sh
pnpm demo:themes
```

This checkout-only command rebuilds the compiler and generates the same research comparison for every registered Theme and Layout. Open `reports/themes/index.html` for live document previews and links to both Layouts. It currently creates twelve reports and the preview index, with interactive switching off; no E2E run, screenshots, server or network is required after dependency installation. Generated files are overwritten on rerun, while unrelated files are retained. See the [examples guide](../examples/README.md) for individual configs and installed-package commands.

## Local extension and offline switching

```sh
pnpm semloom schema --config examples/comparison-plugin/presentation.json
pnpm semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json --interactive -o reports/showcase/plugin.html --explain
```

The Plugin contributes a namespaced note kind and comparison rows, using the same registration/escaping/asset contract as built-ins. Rows/cards/table switch without a request; the note remains static. No-JS output keeps the build selection and sources. A missing adapter does not make a Variant unusable for static compilation.

## Evidence to inspect

Run `pnpm benchmark` for the sourced comparison plus compact, PR daily and wide-data scenarios, each with an edit task. Run `pnpm test:e2e` for 375px, content/source fidelity, print, offline operation and View cleanup. Review representative screenshots in `reports/e2e/`, `reports/interactive/` and the benchmark outputs. Artifacts and per-run metrics are not committed.

These recipes demonstrate implemented workflows. They do not establish general token savings, Planner superiority or human reading preference. Browser automation is Chromium-based; OS-native select menus and other browsers still require their own checks.
