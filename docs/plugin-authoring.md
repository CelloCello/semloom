# Plugin authoring

Plugins are trusted Node.js modules. The CLI loads only explicitly configured local `.js`, `.mjs` or `.cjs` files, with a default-exported manifest. It does not install packages, download modules, scan directories or sandbox build-time code.

For a hierarchy Variant, extend `hierarchy` at data version `1.0` and consume its [bounded node contract](semantic-schema.md#hierarchy-content). Preserve every label, parent/child relationship and sibling order. Nodes are content inside one block; they do not create Sections, TOC entries or Override targets. Core owns the block's citations. The built-ins emit a complete native list; the selected built-in `hierarchy.mindmap` has a Core-owned offline Markmap enhancement with folding, separate from optional Variant-switching adapters. Local Variants do not implicitly acquire that enhancement. Keep wide diagrams locally scrollable and retain all content for no-JS, failure and print. See [branch color customization](themes.md#hierarchy-branch-colors).

## Run the example

```sh
pnpm build
pnpm semloom schema --config examples/comparison-plugin/presentation.json
pnpm semloom validate examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json
pnpm semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json -o reports/plugin.html --explain
pnpm semloom plugins list --config examples/comparison-plugin/presentation.json
```

The config contains `plugins: ["./index.mjs"]`, resolved relative to that config file. The example module imports the local `semloom` package, so build the compiler first. It contributes `example.note` and `example.comparison.rows`. Its CSS consumes theme variables; Core renders citations for both kinds/Variants.

## Manifest and registration

A manifest has `id`, `version`, `pluginApiVersion: "1.0"`, optional `requires` exact Plugin ID/version pairs, and one or both of `kinds`/`extensions`. Versions are exact identifiers, not semver ranges. Empty contributions, unknown manifest/Variant fields, duplicate Plugin/kind/Variant IDs and incompatible versions fail before document processing. Native module import failures are reported as `PLUGIN_LOAD`.

Each kind contribution has `kind`, `dataVersion: "1.0"`, `schema` and `variants`. Local kind names and all Variant IDs are namespaced (for example `example.note` and `example.note.panel`). Kind schemas must be strict, self-contained object schemas with `properties`; they describe content only. Core adds `id`, `kind` and `sourceIds` and forbids redefining them. Unknown content fields are rejected by the effective exported Schema. Optional fields, limits and enumerations belong in that Schema.

Each extension has `targetKind`, exact `targetDataVersion` and `variants`; it cannot provide or change a Schema. All kinds are collected before extensions resolve, independent of module order. Extensions may add a comparison Variant but cannot replace `comparison.cards` or change comparison data.

Each Variant has `id`, `supports(data, presentationContext)`, `score(data, presentationContext)`, `render(data, renderContext)` and optional `assets`. Support returns `{ supported, reason }`; scores must be finite. A lower-scoring compatible Variant is still available to overrides. Context contains locale and layout; render context also includes the block's `headingLevel`. It does not expose a guessed viewport. Rendering must preserve the input fields, order, values, units and plain-text contract; it must not mutate data or create conclusions.

Use the public `html` tagged template and `heading` helper. Interpolated strings are escaped; fragments are recognized privately rather than by a user-forgeable JSON marker. Do not return hand-built fragment objects. Markup must contain no remote resource dependencies, scripts or event handlers. Block citations are composed outside your rendered content by Core, so do not manually duplicate `sourceIds` rendering.

## CSS assets

`assets` is an array of `{ id, type: "css", content, dependsOn? }`. Declare dependencies by asset ID; include their declarations in one of the loaded manifests. CSS is limited to 200,000 characters per asset and must use scoped classes and theme variables. URLs, imports, network image functions, CSS escapes/comments and style terminators are rejected; pre-process complex CSS into this static subset rather than relying on remote assets.

Use the shared [Theme tokens](themes.md) so your content works with all built-in Themes, including dark Midnight, and document/sidebar. Inherit the native color scheme and avoid hardcoded light surfaces; the compiler cannot recolor arbitrary Plugin CSS. Presentation context includes locale and Layout; Theme does not reach Variant scoring or render functions. Verify both Layouts at 375px and print, with all fields and citations retained. Optional browser code must use a declared adapter; authored script tags/event attributes are not supported.

Registry checks all declarations and dependency cycles, including unused Variants, when frozen. Equal IDs require equal content and dependency lists. The compiler bundles selected assets and their transitive dependencies, merges dependencies of equal-content assets and deduplicates by SHA-256. With interactive enabled, eligible candidates' CSS is included too. Ordering is dependency-first with a stable ID order. Contradictory ordering after merging is rejected. Unneeded Variant CSS is omitted; repeated blocks do not duplicate it. SVG can be authored as static geometry with `html`.

## Optional browser adapter

Add `browser: { entry: './browser.mjs', exportName: 'createView', label: '逐項清單' }` to a Variant. Relative entries resolve from the declaring Plugin module. The adapter is a separate browser-compatible module; its synchronous factory returns a detached HTMLElement and dispose function. Use `semloom/browser` for safe HTML/URL helpers and register resources through `context.signal` / `context.onDispose`, including resources allocated before a factory failure. The [interactive contract](interactive.md) covers bundling, CSP, immutable data, eligibility, focus and lifecycle in full.

The example shares `templates.mjs` between Node rendering and `browser.mjs`; Node render functions are never serialized. A Variant without an adapter remains statically usable and is not a switch candidate. Browser metadata is validated during registration, but module/export compatibility is checked only when needed by interactive compilation. `plugins list` adds `browserVariants` arrays alongside existing Variant IDs.

## Library use

```js
import { compile, loadRegistry } from 'semloom';

const config = { plugins: ['./my-plugin.mjs'] };
const registry = await loadRegistry(
  config.plugins,
  '/absolute/config/directory',
);
const result = compile(document, config, registry);
```

`compile()` stays synchronous. It never discovers/loads Plugin registration modules implicitly; passing a nonempty `plugins` config without an explicitly loaded Registry fails with `PLUGIN_LOADING_REQUIRED`. Interactive compilation reads and bundles declared eligible browser entry files. Alternatively use `createRegistry([manifest])` or register complete manifests into `new Registry()` before freezing it, with absolute browser entry paths. The CLI uses the same loaded Registry for Schema export, validation, build and listing.
