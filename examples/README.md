# Examples

Use these semantic documents, presentation configs and trusted local Plugin modules to build reports. From a source checkout, install dependencies and run `pnpm build` first; commands below run at the repository root. Generated HTML belongs in ignored `reports/`.

## Choose a report

For nested ordered/unordered lists, inline links and literal command blocks, use [technical-guide.json](technical-guide.json). It describes a built-checkout workflow with source references; commands are displayed as content and are not executed by the compiler. From the checkout root:

```sh
pnpm semloom validate examples/technical-guide.json
pnpm semloom build examples/technical-guide.json -o reports/technical-guide.html --explain
```

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

## Complete initial/edit workflows

[report-workflows/](report-workflows/README.md) combines the content capabilities into three complete reports: tool comparison, technical guide and architecture grouping. Each ships initial/edited JSON, explicit edit boundaries and independent external Theme/Layout configs. The guide includes a CRLF/indentation/special-character code sample; architecture uses a long Chinese label and a complete subtree move. The linked guide contains checkout and installed CLI commands.

## Hierarchy and mindmap

[hierarchy.json](hierarchy.json) groups project concepts into one tree. The same JSON supports an indented tree by default and a real offline Markmap via [hierarchy-mindmap.json](hierarchy-mindmap.json), without Markdown conversion. That config also registers/selects the external paper Theme and right-side TOC Layout; keep the `presentation/` manifests and styles alongside it. Labels are plain text, siblings retain input order, and sources belong to the block. All screen widths retain the enhanced diagram with local scrolling; no-JS, setup failure and print show the complete tree. See the [node contract](../docs/semantic-schema.md#hierarchy-content).

The mindmap uses Markmap's native curves, text underlines and circular junctions. Click a junction or focus it and press Enter/Space to fold/unfold; zoom and pan are disabled. The `interactive` flag controls separate Variant switching and is not needed for mindmap folding. [hierarchy-reference.json](hierarchy-reference.json) reproduces the short labels of the supplied visual reference. Use [hierarchy-reference-mindmap.json](hierarchy-reference-mindmap.json) to build it in Midnight. [Theme CSS](../docs/themes.md#hierarchy-branch-colors) can override branch colors independently of the data.

```sh
pnpm build
pnpm semloom validate examples/hierarchy.json
pnpm semloom build examples/hierarchy.json -o reports/hierarchy-tree.html --explain
pnpm semloom validate examples/hierarchy.json --config examples/hierarchy-mindmap.json
pnpm semloom build examples/hierarchy.json --config examples/hierarchy-mindmap.json -o reports/hierarchy-mindmap.html --explain
pnpm semloom build examples/hierarchy.json --config examples/hierarchy-mindmap.json --theme example.night -o reports/hierarchy-night.html
pnpm semloom build examples/hierarchy-reference.json --config examples/hierarchy-reference-mindmap.json -o reports/hierarchy-reference.html
```

For edits, move the whole node object, including `children`, to another parent's array and rename its `label`. Revalidate and rebuild both Variants; do not edit generated HTML or add document Sections just to place diagram nodes.

[hierarchy-palettes.json](hierarchy-palettes.json) is illustrative content for comparing all six built-in Theme palettes. Each of its seven main branches has a child: descendants inherit their branch color, and branch seven repeats color one. Reuse the mindmap config and override its Theme selection:

```sh
pnpm semloom build examples/hierarchy-palettes.json --config examples/hierarchy-mindmap.json --theme ocean -o reports/hierarchy-ocean.html
```

Use `minimal`, `editorial`, `ocean`, `graphite`, `signal` or `midnight`; the data and hierarchy stay identical. See the [palette values and external CSS overrides](../docs/themes.md#hierarchy-branch-colors).

## Choose presentation

[External presentation](presentation/presentation.json) registers paper/night Themes and a right-side TOC Layout. Keep its JSON manifests and `styles/` directory together when copying it into a report project; paths are relative to the config and each manifest. See [authoring](../docs/presentation-authoring.md) for creating your own definitions and the independent Theme/Layout selection.

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
