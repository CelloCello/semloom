# Examples

Use these semantic documents, presentation configs and trusted local Plugin modules to build reports. From a source checkout, install dependencies and run `pnpm build` first; commands below run at the repository root. Generated HTML belongs in ignored `reports/`.

## Choose a report

| Goal                                              | Document                                       | Presentation                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Read a documentation-backed research comparison   | [comparison.json](comparison.json)             | Auto selects a table; optional [cards override](presentation.json).                                                      |
| Explore a complete illustrative PR handoff report | [pr-daily.json](pr-daily.json)                 | All six kinds; optional [editorial/sidebar](editorial-sidebar.json).                                                     |
| Write a process explanation with sources          | [report-workflow.json](report-workflow.json)   | Authoring, validation and editing workflow; reuse [editorial/sidebar](editorial-sidebar.json).                           |
| Learn the six original kinds                      | [blocks.json](blocks.json)                     | Six literal-content kinds; optional [steps list override](steps-list.json).                                              |
| Format a paragraph with marks and links           | [richtext.json](richtext.json)                 | Rich Text with combined marks, a forward link and unchanged literal prose.                                               |
| See Auto choose comparison cards                  | [cards.json](cards.json)                       | Illustrative collaboration data, without an override.                                                                    |
| Add a local kind and comparison Variant           | [Plugin report](comparison-plugin/report.json) | [Plugin config](comparison-plugin/presentation.json), registration, templates and browser adapter in the same directory. |

```sh
pnpm semloom validate examples/comparison.json
pnpm semloom build examples/comparison.json -o reports/research.html --explain
pnpm semloom build examples/pr-daily.json --config examples/editorial-sidebar.json -o reports/pr-daily.html
pnpm semloom validate examples/report-workflow.json --config examples/editorial-sidebar.json
pnpm semloom build examples/report-workflow.json --config examples/editorial-sidebar.json -o reports/report-workflow.html --explain
pnpm semloom build examples/blocks.json --config examples/steps-list.json -o reports/blocks.html
pnpm semloom build examples/cards.json -o reports/cards.html
```

The PR, cards and block catalog data is illustrative. The research report cites its sources; compilation does not verify those sources or the author's conclusions.

The workflow report summarizes the project's authoring and installation guides using prose, an insight, a comparison and steps. It demonstrates a process explanation with stable IDs and block citations. It contains no machine-specific paths, version snapshot or claim that a particular Agent/environment passed validation. Presentation comes from the existing config, so the same document can be rebuilt with another Theme or Layout.

## Choose presentation

Configs are not semantic documents. Pass them with `--config` alongside a report rather than validating them as report input. Overrides target IDs in their intended report.

| Config                                           | Use with          | Effect                                                         |
| ------------------------------------------------ | ----------------- | -------------------------------------------------------------- |
| [presentation.json](presentation.json)           | `comparison.json` | Force comparison cards.                                        |
| [editorial-sidebar.json](editorial-sidebar.json) | Any report        | Editorial Theme and sidebar Layout.                            |
| [interactive.json](interactive.json)             | `comparison.json` | Editorial/sidebar with optional offline cards/table switching. |
| [steps-list.json](steps-list.json)               | `blocks.json`     | Force the block named `sequence` to use steps list.            |
| [themes/ocean.json](themes/ocean.json)           | Any report        | Ocean Theme.                                                   |
| [themes/graphite.json](themes/graphite.json)     | Any report        | Graphite Theme.                                                |
| [themes/signal.json](themes/signal.json)         | Any report        | Signal Theme.                                                  |
| [themes/midnight.json](themes/midnight.json)     | Any report        | Explicit dark Midnight Theme.                                  |

Theme configs leave Layout at its default unless another option supplies it. Minimal is the default Theme; editorial can also be selected with `--theme editorial`. Use `themes list` to list every registered Theme. See [Themes and Layouts](../docs/themes.md) for palettes, precedence and print behavior.

```sh
pnpm semloom build examples/comparison.json --config examples/themes/midnight.json --layout sidebar -o reports/midnight.html
pnpm semloom build examples/comparison.json --config examples/interactive.json -o reports/interactive.html
```

## Compare all Themes and Layouts

From the source checkout:

```sh
pnpm demo:themes
```

Open `reports/themes/index.html`. The command rebuilds the compiler, then generates the research comparison for every registered Theme/Layout pair and a local preview page. Currently that is twelve reports plus the index. The same content is used throughout, with interactive switching left off. It needs no prior test run, screenshots, network or server after dependencies are installed. Rerunning overwrites its generated files; unrelated files in that output directory are retained.

## Try a local Plugin

```sh
mkdir -p reports
node dist/cli/main.js schema --config examples/comparison-plugin/presentation.json > reports/plugin.schema.json
pnpm semloom validate examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json
pnpm semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json --interactive -o reports/plugin.html
```

Keep the Plugin's [registration](comparison-plugin/index.mjs), [templates](comparison-plugin/templates.mjs) and [browser adapter](comparison-plugin/browser.mjs) together. Configured Plugin modules execute trusted code. See [Plugin authoring](../docs/plugin-authoring.md).

## Use an installed package or coding Agent

For a project-local compiled tarball installation, follow the [release guide](../docs/releases.md), copy the installed `examples` directory into the report project, and replace `pnpm semloom` with `npx --no-install semloom`. Confirm the local package exists first. With a global CLI, use `semloom` and locate bundled examples under `$(npm root --global)/semloom/examples`, using the same active Node/npm installation. For the Plugin example, keep its modules in the installed package and pass its absolute config path; copying it to a project requires a project-local Semloom dependency for its imports. For clean Schema stdout use the installed CLI or, in a checkout, the direct Node entry above. The checkout-only `demo:themes` command is not part of the installed runtime package; installed consumers can build individual combinations with the CLI.

The [Agent guide](../docs/agent-guide.md) and [Semloom skill installation](../docs/skills.md) describe authoring and registration. Test-only failure fixtures, benchmark inputs and per-run development records are maintained separately from these user-facing examples.
