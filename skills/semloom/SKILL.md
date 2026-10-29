---
name: semloom
description: Create or update standalone offline HTML reports with Semloom from supplied facts and semantic JSON. Use when Semloom is requested or an existing Semloom report needs editing; not for general website development or other output formats.
---

# Semloom reports

Produce semantic JSON and a compiled HTML report while preserving the user's facts, evidence and requested presentation.

## Locate the matching tool and references

Resolve this skill directory's filesystem real path before following relative links, including when loaded through a symlink. The Semloom checkout or installed package root is two directories above that physical directory. Keep its `docs/` and `examples/` alongside `skills/`; copying only this file breaks the references.

Read the [Agent guide](../../docs/agent-guide.md) for the content contract and workflow. Use the CLI from the same checkout or package as these references; check `--version` before starting. Keep the working directory at the user's report project so input, output and config paths resolve there.

| Mode                  | CLI entry                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Built source checkout | `node /absolute/path/to/semloom/dist/cli/main.js ...` works from the report project. At the checkout root, `pnpm semloom ...` is also available.                                                                                                      |
| Project-local package | First confirm `node_modules/semloom/package.json` exists in the report project, then use `npx --no-install semloom ...` there. For an unambiguous entry, use `node /absolute/path/to/project/node_modules/semloom/dist/cli/main.js ...`.              |
| Global CLI            | Confirm `semloom` resolves on PATH and use `semloom ...` from the report project. With the same active Node/npm prefix, `npm root --global` locates the package at `<root>/semloom`; its skill, docs and examples must match the selected executable. |

If using a registered skill from a different checkout/package, reconcile the reference root and CLI before proceeding. If the CLI is missing, use the [installation guide](../../docs/releases.md) for the chosen route; a checkout needs dependencies and `pnpm build`, whereas a compiled tarball already contains `dist/`. Do not let `npx` fetch an unrelated package as a fallback.

With multiple Node versions or npm prefixes, check the actual CLI and skill target rather than assuming `npm root --global` describes the executable on PATH. A global CLI does not provide `import 'semloom'` to unrelated project files. For library use or Plugins with that import, install a project dependency or keep the Plugin modules in their original package location; see the [Agent guide](../../docs/agent-guide.md). Report authoring does not require changing global npm settings or shell startup files.

## Generate or update a report

For user-provided Theme/Layout manifests, follow [external presentation authoring](../../docs/presentation-authoring.md). Use the same explicit config for schema, validation, build and listings; choose registered IDs without rewriting semantic JSON. External Layouts inherit a document/sidebar base and do not change content or citation ownership.

1. Read the existing document and presentation config, or gather the supplied facts for a new report. Use [comparison](../../examples/comparison.json) or [PR handoff](../../examples/pr-daily.json) only as structural examples; their facts are not the user's facts.
2. Run `schema` through the chosen CLI and read its effective JSON Schema. When a trusted local Plugin config is selected, pass the same `--config path/to/config.json` to `schema`, `validate` and `build`; use `plugins list` with that config when extension details matter. Do not substitute a static kind/field catalog. Saving Schema stdout requires the direct Node entry or installed CLI: `pnpm semloom` can add package-manager banners.
3. Write or edit semantic JSON according to that Schema and the Agent guide. Keep existing text fields literal; use `richtext.content` or List item `content` with explicit marks/links for inline formatting, following the [inline contract](../../docs/semantic-schema.md#inline-content). Use `list` for collections with explicit order/nesting, `steps` for titled operations and `code` for literal code/commands; see the [technical guide](../../examples/technical-guide.json). Use stable section/block IDs, preserve field order and block-level references, and never invent evidence. Fix validation diagnostics at their file and JSON-pointer locations without dropping supplied facts to satisfy the Schema.
4. Run `validate report.json` and then `build report.json -o reports/report.html --explain`, with the same config. Explain goes to stderr and describes the actual initial selection. For edits, change only the relevant semantic values/config and rebuild.
5. Inspect the generated report for the requested change, content fidelity, references and presentation. When browser tooling is available, open the actual HTML and check the relevant behavior; otherwise disclose that visual verification was not performed. Return the JSON/config and HTML paths and the checks actually run.

Use [data contracts](../../docs/semantic-schema.md) for semantics beyond structural validation, [CLI recipes](../../docs/cli-cookbook.md) for command options, and [Plugin authoring](../../docs/plugin-authoring.md) only when extending kinds or Variants. Local Plugin modules execute trusted code: use the selected config rather than discovering or installing Plugins automatically.

Use `hierarchy.root` with a literal `label` and ordered `children` for knowledge/architecture trees. Nodes are block content, separate from Sections/TOC entries; supply no coordinates, per-node IDs or Markdown conversion. Preserve complete subtrees when moving branches. Default is static `hierarchy.tree`; an explicit Override selects an offline `hierarchy.mindmap` rendered by embedded Markmap with mouse/keyboard node folding. It stays graphical on narrow screens, with local scrolling; no-JS, setup failure and print show the complete tree. This enhancement is independent of the `interactive` Variant-switching flag; zoom/pan are disabled. Follow the [node contract and limits](../../docs/semantic-schema.md#hierarchy-content) and [build/edit example](../../examples/README.md#hierarchy-and-mindmap), using the same config for schema, validation and build. Block-level sources remain unchanged by presentation selection.

Theme controls appearance, Layout controls the page arrangement, and compatible Variant overrides control individual block presentation. Follow the requested presentation using [Themes and Layouts](../../docs/themes.md). Enable [interactive switching](../../docs/interactive.md) only when requested or needed by the reader; it defaults to off. Do not generate bespoke CSS/DOM to work around a data validation error. Compilation does not calculate metrics or verify factual claims, and needs no LLM API key.

For complete initial/edit examples, use the [three report workflows](../../examples/report-workflows/README.md): tool comparison, technical guide and architecture grouping. Reuse their structure/configs while retaining the user's own facts. After edits, check preserved field order/values, inline marks/links, exact code text, nested items or moved subtrees, plus IDs and source references; rebuild and inspect narrow-screen/no-JS/print output as applicable. Fixed examples are not evidence of an Agent run or model cost savings.
