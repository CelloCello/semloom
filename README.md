# Semloom

**Write the facts. Let Semloom format the report.**

English · [繁體中文](README.zh-TW.md)

Semloom turns semantic JSON into a single, self-contained HTML report. Use it for research comparisons, engineering handoffs, project updates and process guides—whether you write the data yourself or ask a coding agent to prepare it.

Keep the content in JSON, choose a presentation, and share the HTML. Reports work offline, adapt to small screens and include print styles. No API key, server, CDN or remote fonts are required after dependencies are installed.

## What you get

- **Structured content:** prose, comparisons, insights, metrics, steps and timelines, with block-level source references.
- **Reusable presentation:** six Themes, two Layouts and compatible block Variants; change appearance while preserving the data.
- **Clear validation:** export JSON Schema, catch invalid fields/references, and inspect presentation choices with `--explain`.
- **Optional interaction:** switch compatible comparison views offline. Complete content stays readable without JavaScript.
- **Agent and library workflows:** a bundled skill, an ESM API and trusted local Plugin extensions.

## Quick start

Requires **Node.js 22 (22.14+) or 24**, and **pnpm 10.28.2** for a source checkout.

```sh
git clone https://github.com/CelloCello/semloom.git
cd semloom
pnpm install --frozen-lockfile
pnpm build
pnpm semloom build examples/pr-daily.json --theme ocean --layout sidebar -o reports/report.html
```

Open `reports/report.html` directly in a browser. It is a standalone file you can copy or share. The PR report contains illustrative data.

Already have a compiled `.tgz` archive? Install it with `npm install ./semloom-VERSION.tgz`, then use `npx --no-install semloom`. See the [installation guide](docs/releases.md) for examples and package details. A public npm installation is not currently provided.

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
pnpm semloom validate report.json
pnpm semloom build report.json -o reports/project-update.html --explain
```

All content strings are plain text. Source references belong to blocks; the compiler checks their relationships but does not verify factual claims or calculate metrics. See the [data contract](docs/semantic-schema.md) for supported fields and limits.

## Choose a look

```sh
pnpm semloom build report.json --theme midnight --layout sidebar -o reports/project-update.html
pnpm semloom themes list
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

Use the [bundled Semloom skill](skills/semloom/SKILL.md) to guide an agent through Schema discovery, semantic authoring, validation and rebuilding after edits. Follow the [skill installation guide](docs/skills.md) to register it with your agent; installing the package does not register the skill automatically.

To export a clean Schema JSON file from a checkout:

```sh
mkdir -p reports
node dist/cli/main.js schema > reports/semantic.schema.json
```

Use the same `--config` for `schema`, `validate` and `build` when loading local Plugins. The [Agent guide](docs/agent-guide.md) covers content, sources and configuration.

## Optional interactive reports

```sh
pnpm semloom build examples/comparison.json --interactive -o reports/interactive.html
```

Interactive mode is off by default. When enabled, supported browser-enabled comparison Variants can be switched inside the report without a request. The initial HTML remains complete, and block citations stay in place. See [interactive reports](docs/interactive.md) for behavior and adapters.

## JavaScript API

Use the ESM API from a built checkout or installed package:

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
