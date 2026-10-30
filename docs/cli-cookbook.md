# CLI cookbook

Local Theme/Layout JSON registrations use `themes`/`layouts` in `--config`. Select their registered IDs with `--theme`/`--layout`; use `themes list --config ...` and `layouts list --config ...` to discover them. See [external presentation](presentation-authoring.md) for a right-side TOC, manifest-relative CSS and Library integration.

Run from a checkout after the [README installation](../README.md). The compiler needs no LLM API key. Commands below use local inputs and write ignored output under `reports/`.

`pnpm semloom --version` reports the installed package version. Plugin/API/data versions remain separate and are listed through `plugins list` or Schema metadata.

## Validate, explain and build

```sh
pnpm semloom validate examples/comparison.json
pnpm semloom build examples/comparison.json -o reports/research.html --explain
pnpm semloom build examples/pr-daily.json --config examples/editorial-sidebar.json -o reports/pr-daily.html --explain
```

Open the HTML directly using `file://`. `--explain` writes the actual selected Variant, support/score reasons and Override origin to stderr. `schema` and `list` write JSON to stdout. Diagnostics contain JSON-pointer paths. Exit status is 0 for success, 2 for input/config/validation errors and 1 for compilation/I/O errors. A failed build preserves the prior output; output cannot overwrite input or config.

## Change appearance or presentation

```sh
pnpm semloom themes list
pnpm semloom build examples/comparison.json --theme editorial --layout sidebar -o reports/editorial.html
pnpm semloom build examples/comparison.json --config examples/presentation.json -o reports/cards.html
pnpm semloom build examples/blocks.json --config examples/steps-list.json -o reports/list.html
```

`presentation.json` forces `languages` to `comparison.cards`; `steps-list.json` forces `sequence` to `steps.list`. Overrides require explicit block IDs and a compatible Variant. CLI appearance options override a valid config, then defaults apply; an invalid config still fails before merging. Static HTML keeps the build selection. To change a static Variant, edit config and rebuild.

## Enable offline switching

```sh
pnpm semloom build examples/comparison.json --config examples/interactive.json -o reports/interactive.html
pnpm semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json --interactive -o reports/plugin-interactive.html
pnpm semloom build examples/comparison.json --config examples/interactive.json --no-interactive -o reports/static.html
```

`interactive` is a strict boolean and defaults off. CLI flags apply only to build; use config for validate/schema with the same effective configuration. `--no-interactive` overrides a true config. Both positive and negative flags together fail, and an invalid config cannot be rescued by a CLI flag. Browser bundling errors report `BROWSER_BUNDLE` with exit code 1 and preserve an existing output. `plugins list` includes declared `browserVariants`; data-specific candidates still require compatibility checks. See [interactive reports](interactive.md).

## Give an Agent the effective Schema

Use `pnpm semloom schema` to inspect the contract. To save pure JSON without pnpm's script banner, call the compiled entry point:

```sh
mkdir -p reports
node dist/cli/main.js schema > reports/document.schema.json
node dist/cli/main.js schema --config examples/comparison-plugin/presentation.json > reports/plugin.schema.json
pnpm semloom plugins list --config examples/comparison-plugin/presentation.json
pnpm semloom validate examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json
pnpm semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json --theme editorial --layout sidebar -o reports/plugin.html
```

Use the same config for Schema, validate and build. Plugin paths resolve relative to the config file. Read the [Agent guide](agent-guide.md) for the generation/edit loop, the [Schema contract](semantic-schema.md) for plain text and block references, and [Plugin authoring](plugin-authoring.md) before loading code. Only load modules you trust: they execute with Node.js access at build time.
