# Semloom

**Write the facts. Let Semloom format the report.**

English · [繁體中文](README.zh-TW.md)

Semloom turns semantic JSON into a single, self-contained HTML report. Use it for research comparisons, engineering handoffs, project updates and process guides—whether you write the data yourself or ask a coding agent to prepare it.

Keep the content in JSON, choose a presentation, and share the HTML. Reports work offline, adapt to small screens and include print styles. No API key, server, CDN or remote fonts are required after dependencies are installed.

## What you get

- **Structured content:** prose, rich text, nested lists, code, comparisons, insights, metrics, steps, timelines and hierarchy trees/mindmaps, with block-level source references.
- **Reusable presentation:** six built-in Themes, two Layout bases, local Theme/Layout extensions and compatible block Variants; change appearance while preserving the data.
- **Clear validation:** export JSON Schema, catch invalid fields/references, and inspect presentation choices with `--explain`.
- **Optional interaction:** switch compatible comparison views offline. Complete content stays readable without JavaScript.
- **Agent and library workflows:** a bundled skill, an ESM API and trusted local Plugin extensions.

## Quick start

Requires **Node.js 22 (22.14+) or 24**, and **pnpm 10.28.2** for a source checkout.

If you have a compiled `.tgz` archive, install the global CLI:

```sh
npm install --global ./semloom-VERSION.tgz
semloom --version
semloom --help
```

You can then run `semloom` from your report directory, provided npm's global executable directory is on your PATH. Use the same active Node/npm installation when locating the package or registering its skill. Remove it with `npm uninstall --global semloom`. See the [installation guide](docs/releases.md#global-cli) for details. A public npm registry package is not currently provided; a compiled archive can be obtained from a GitHub Release when one is published.

For a project-local installation, run `npm install ./semloom-VERSION.tgz` and use `npx --no-install semloom` instead. To build from source:

```sh
git clone https://github.com/CelloCello/semloom.git
cd semloom
pnpm install --frozen-lockfile
pnpm build
pnpm semloom build examples/pr-daily.json --theme ocean --layout sidebar -o reports/report.html
```

Open `reports/report.html` directly in a browser. It is a standalone file you can copy or share. The PR report contains illustrative data.

The commands below use the global CLI. With a project-local package, replace `semloom` with `npx --no-install semloom`; at the source checkout root, use `pnpm semloom`.

## Write your first report

Save this as `report.json`:

```json
{
  "schemaVersion": "1.0",
  "title": "Project update",
  "sections": [
    {
      "id": "summary",
      "title": "Summary",
      "blocks": [
        { "kind": "prose", "text": "The migration is ready for review." }
      ]
    }
  ]
}
```

Validate it and build the HTML:

```sh
semloom validate report.json
semloom build report.json -o reports/project-update.html --explain
```

Existing text fields display literally. Use the explicit `richtext` kind for emphasis, inline code and links; see the [Rich Text example](examples/richtext.json). The [technical guide](examples/technical-guide.json) combines this inline content with nested lists and literal code blocks. The [hierarchy example](examples/hierarchy.json) renders as an indented tree by default; its [mindmap config](examples/hierarchy-mindmap.json) selects an offline Markmap with mouse/keyboard node folding, an external Theme and right-side TOC. Each built-in Theme supplies its own [six-color branch palette](docs/themes.md#hierarchy-branch-colors). Narrow screens retain the diagram with local scrolling; no-JS, initialization failure and print retain the complete tree. Source references belong to blocks; the compiler checks their relationships but does not verify factual claims or calculate metrics. See the [data contract](docs/semantic-schema.md) for supported fields and limits.

## Choose a look

For complete initial/edit tasks, see [three report workflows](examples/report-workflows/README.md): a tool comparison, a technical guide and architecture grouping. Each includes semantic inputs, exact edit boundaries and external Theme/Layout configs. Rebuild from JSON/config after edits; generated HTML needs no manual patching.

```sh
semloom build report.json --theme midnight --layout sidebar -o reports/project-update.html
semloom themes list
```

| Theme       | Character                                             |
| ----------- | ----------------------------------------------------- |
| `minimal`   | Warm white, green accents, system sans. The default.  |
| `editorial` | Warm paper, brown accents, local serif fonts.         |
| `ocean`     | Cool white, navy text, blue accents.                  |
| `graphite`  | Neutral white and charcoal, compact reading rhythm.   |
| `signal`    | White, strong titles, brick-red accents.              |
| `midnight`  | Dark blue-gray surfaces, soft-white text, cyan links. |

![The same comparison report in all six Semloom Themes](docs/assets/themes.webp)

Layout is a separate choice: `document` places the table of contents above the report; `sidebar` puts it beside desktop content and uses a mobile disclosure. All Themes work with both Layouts, and print uses a light palette.

From a checkout, run `pnpm demo:themes` and open `reports/themes/index.html` to compare all twelve combinations. See [Themes and Layouts](docs/themes.md) for styling and extension details.

## Work with a coding agent

To create your own style or page arrangement, register local JSON manifests. The [external presentation guide](docs/presentation-authoring.md) includes light/dark Themes and a right-side TOC Layout; no edits or rebuild of Semloom are needed.

Use the [bundled Semloom skill](skills/semloom/SKILL.md) to guide an agent through Schema discovery, semantic authoring, validation and rebuilding after edits. Follow the [skill installation guide](docs/skills.md) to register it with your agent; installing the package does not register the skill automatically.

To export a clean Schema JSON file with the global CLI:

```sh
mkdir -p reports
semloom schema > reports/semantic.schema.json
```

For a project-local package, use `npx --no-install semloom schema`; from a checkout, use `node dist/cli/main.js schema` because `pnpm semloom` can add banners to stdout. Use the same `--config` for `schema`, `validate` and `build` when loading local Plugins. The [Agent guide](docs/agent-guide.md) covers content, sources and configuration.

## Optional interactive reports

From a source checkout, try the bundled comparison example:

```sh
pnpm semloom build examples/comparison.json --interactive -o reports/interactive.html
```

Interactive mode is off by default. When enabled, supported browser-enabled comparison Variants can be switched inside the report without a request. The initial HTML remains complete, and block citations stay in place. See [interactive reports](docs/interactive.md) for behavior and adapters.

## JavaScript API

Use the ESM API from a built checkout or a project-local package. A global CLI installation does not make `import 'semloom'` available to arbitrary project files:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'semloom';

const input = JSON.parse(await readFile('report.json', 'utf8'));
await writeFile('report.html', compile(input, { theme: 'ocean' }).html);
```

For extensions, [local Plugins](docs/plugin-authoring.md) can add kinds and Variants. Plugin modules and browser adapters execute trusted code; only load modules you trust. The compiler does not discover or install Plugins automatically.

## Explore and contribute

| Start here                           | Find                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [Examples](examples/README.md)       | Research, PR handoff, process guides, block catalog and Plugin samples. |
| [Showcase recipes](docs/showcase.md) | Commands for complete reports and the Theme gallery.                    |
| [CLI cookbook](docs/cli-cookbook.md) | Validation, configuration, overrides and diagnostics.                   |
| [Architecture](docs/architecture.md) | Compiler boundaries, rendering and extension contracts.                 |
| [Evaluation](docs/evaluation.md)     | Reproducible measurements and their limits.                             |
| [Package guide](docs/releases.md)    | Building, installing and verifying compiled archives.                   |

For development:

```sh
pnpm browsers:install
pnpm check
pnpm test:package
```

Use `pnpm benchmark` for the fixed evaluation scenarios. Generated reports, screenshots and measurements are kept outside version control. To report a bug or suggest an improvement, [open an issue](https://github.com/CelloCello/semloom/issues) with a minimal input and expected output.

## License

[MIT](LICENSE), © 2026 Semloom contributors. The runtime notice embedded in generated HTML covers Semloom's code; rights to input content and cited sources remain with their respective owners.
