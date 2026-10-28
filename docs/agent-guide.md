# Agent guide

## Choose the CLI

| Environment                                      | Commands                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Built source checkout, at its root               | `pnpm semloom ...`; use `node dist/cli/main.js ...` for clean JSON stdout.                   |
| Report project with a local package installation | Confirm `node_modules/semloom/package.json` exists, then use `npx --no-install semloom ...`. |
| Report project using a separate checkout         | `node /absolute/path/to/semloom/dist/cli/main.js ...` from the report project.               |

Check `--version` and read docs/examples from that same installation. A checkout needs dependencies and `pnpm build`; the compiled tarball needs no consumer build hook. See [installation](releases.md) and the optional [coding Agent skill](skills.md). Do not implicitly download a CLI or Plugin. Keep the report project as the working directory; config module paths are relative to their config file.

Plugin imports resolve from the declaring module's location. When using a checkout from a separate report project, the example Plugin config can stay in the checkout and be passed by absolute path. Copying those Plugin modules into a project without a local Semloom installation breaks their `import 'semloom'`; either retain their checkout location or use the installed-package route before copying them.

The workflow below uses the checkout prefix; substitute the selected entry for installed-package use. When saving Schema JSON, use `node dist/cli/main.js schema > semantic.schema.json` in a checkout, or `npx --no-install semloom schema > semantic.schema.json` in an installed project. `pnpm semloom` may add banners to stdout. Include the same `--config` when applicable.

## Report workflow

1. Run `schema` with the selected CLI and read the effective schema. Read [comparison](../examples/comparison.json) for real research data or [blocks](../examples/blocks.json) for all six built-in kinds with illustrative data. Use `--config` consistently when local Plugins are configured; `plugins list --config ...` shows the loaded kinds and Variant extensions.
2. Write JSON describing the supplied facts. Give sections stable IDs for external links and blocks explicit IDs for overrides. Add ordered comparison fields; attributes must use their keys.
3. Keep every content string plain text. Put citations in document sources and reference source IDs at block level; do not invent sources or put HTML/Markdown formatting in fields.
4. Run `pnpm semloom validate your-document.json`. Fix the file and JSON-pointer locations in diagnostics. Unknown kinds/fields are errors; do not silently drop data to make validation pass.
5. Run `pnpm semloom build your-document.json -o reports/report.html --explain`. Inspect the chosen variants. If a different compatible presentation is desired, put an override in a separate config and rebuild.
6. For an update, modify only the relevant semantic values, revalidate, rebuild and check the output. No CSS/DOM generation or LLM request is needed inside the compiler.

Sources are optional when the report has none, but missing evidence must not be presented as verified. The renderer does not calculate metrics, draw new conclusions or verify factual claims.

Run `themes list` for available Themes and see [Themes and Layouts](themes.md) for their palettes, including the explicit dark `midnight` Theme. Layouts are `document`/`sidebar`. Theme changes only style. Pick Theme, Layout and block Overrides at build time. Enable `interactive: true` or `--interactive` only when the reader needs offline switching among compatible browser-enabled Variants; default is off. It does not change content or the initial build selection. Local Plugin modules are explicitly configured, with paths relative to the config file; Semloom does not install them. The full Registry API is exported for library integration. Use the effective Schema and [Plugin documentation](plugin-authoring.md) rather than loading every Plugin's implementation into the Agent context. See the [CLI cookbook](cli-cookbook.md) for complete commands.
