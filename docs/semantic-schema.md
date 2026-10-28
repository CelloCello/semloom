# Semantic document contract

`pnpm semloom schema` exports the effective draft-07 schema, including configured local Plugins. The document supports `schemaVersion: "1.0"`, a nonempty title and at least one section. Unknown fields are errors; validation never coerces or mutates data. Optional locale defaults to `zh-TW` in presentation only.

Sections have a title, optional ID, optional blocks and child sections. Own blocks appear before children. Empty sections are allowed. Limits: eight section levels, 200 total sections, 1,000 total blocks, 200 sources and 5 MB CLI JSON input. Titles/labels are limited to 1,000 characters; IDs to 200, with no whitespace/control characters or reserved `semloom-` prefix.

## Blocks

Common fields are `kind`, optional `id` and optional unique `sourceIds`. IDs are document-wide unique across sections and blocks. Automatic IDs are deterministic for identical input but can change after editing; overrides require explicit block IDs.

- `prose`: nonempty `text`, at most 100,000 characters. All text, including Markdown/HTML-like strings, displays literally; no inline formatting or automatic links.
- `comparison`: nonempty `subject`, `fields` (1–50), `items` (1–1,000). A field has unique `key`, `label` and optional `unit`. An item has `name` and `attributes`; only declared field keys may appear. Values are strings (up to 20,000 characters), finite numbers, booleans or null. Missing/null display “未提供”; zero, false and empty string are preserved. Input field and item order is preserved.
- `insight`: `level` is `info`, `success`, `warning` or `error`; nonempty `text` is limited to 20,000 characters. The level is supplied by the author, not inferred from the text.
- `metrics`: 1–100 items with nonempty `label` and finite numeric `value`; optional `unit`, `comparisonValue` and `comparisonLabel`. A comparison label requires a comparison value; the same unit applies to both. Zero and negative values are preserved. No differences, percentage changes, unit conversion or good/bad judgments are calculated.
- `steps`: optional `title` and 1–200 items, each with nonempty `title` and optional `description` (up to 20,000 characters). Both list/stepper show all content in input order; stepper is a static sequence, not a wizard or progress tracker. Auto favors stepper for 2–5 short steps, otherwise list; compatible overrides can select either.
- `timeline`: optional `title` and 1–200 items with `time`, `title`, optional `description`. Time is nonempty author-provided text, not parsed, normalized, timezone-converted or sorted. The vertical list preserves input order.

## References

Document `sources` is optional. A source has unique `id`, plain `title`, optional absolute HTTP(S) `url` or an existing document fragment. Credentials, whitespace/control characters and other schemes are rejected. No URL is fetched during build or on report load.

Block `sourceIds` is optional and ordered; dangling/duplicate references fail. Sources without URLs and unused sources still appear in the ordered source list. Core displays “本區塊來源” beneath the block for every variant. This does not prove individual cells or sentences.

The exported schema validates structure. Uniqueness across nodes, total node counts, field-key relationships, safe/existing URLs and reference targets are additional semantic checks performed by both `validate` and `build`.

## Presentation config

Config accepts `theme: "minimal" | "editorial" | "ocean" | "graphite" | "signal" | "midnight"`, `layout: "document" | "sidebar"`, an `overrides` object and a `plugins` array of explicit local `.js`/`.mjs`/`.cjs` module paths. Defaults are `minimal`/`document`. Relative paths resolve from the config directory. The same loaded Registry is used by Schema export, validate, build and list. Theme affects CSS tokens only; Layout participates in presentation context. See [Themes and Layouts](themes.md).

Each override maps an explicit block ID to a compatible full Variant ID: `comparison.cards`, `comparison.table`, `prose.paragraph`, `insight.callout`, `metrics.summary`, `steps.list`, `steps.stepper`, `timeline.vertical`, or a loaded Plugin contribution. Unknown targets, sections, automatic IDs and unsupported selections are errors. No permissive fallback is provided. See [Plugin authoring](plugin-authoring.md) for registration, compatibility and assets.

Config also accepts `interactive: boolean` (default `false`). Build flags `--interactive` / `--no-interactive` override a valid config; supplying both is an error. This flag does not alter semantic validation, build-time selection or the initial static content. The browser selector contains only supported Variants with adapters, including low-score compatible ones; fewer than two candidates produces no selector or switching payload. Runtime data contains resolved block IDs and the same validated content, frozen against adapter mutation. Block sources remain outside the replaceable View. See [interactive reports](interactive.md).
