# Semantic document contract

`pnpm semloom schema` exports the effective draft-07 schema, including configured local Plugins. The document supports `schemaVersion: "1.0"`, a nonempty title and at least one section. Unknown fields are errors; validation never coerces or mutates data. Optional locale defaults to `zh-TW` in presentation only.

Sections have a title, optional ID, optional blocks and child sections. Own blocks appear before children. Empty sections are allowed. Limits: eight section levels, 200 total sections, 1,000 total blocks, 200 sources and 5 MB CLI JSON input. Titles/labels are limited to 1,000 characters; IDs to 200, with no whitespace/control characters or reserved `semloom-` prefix.

## Blocks

Common fields are `kind`, optional `id` and optional unique `sourceIds`. IDs are document-wide unique across sections and blocks. Automatic IDs are deterministic for identical input but can change after editing; overrides require explicit block IDs.

- `prose`: nonempty `text`, at most 100,000 characters. All text, including Markdown/HTML-like strings, displays literally; no inline formatting or automatic links.
- `richtext`: `content` is an ordered array of inline runs, rendered by `richtext.paragraph`. Each run has nonempty `text`, optional `marks` and optional `href`. See the inline contract below; existing plain-text fields do not interpret these structures.
- `list`: explicit boolean `ordered` and nonempty `items`, rendered by `list.nested`. Each item has inline `content` and optional `children`, which is another `{ ordered, items }` group. See the list contract below.
- `code`: nonempty literal `text` up to 100,000 Unicode code points and optional nonempty `language` up to 100 characters, rendered by `code.block`. The language is a display label, not an executable mode or syntax-highlighting instruction. Whitespace, blank lines, tabs and CRLF/CR are preserved in DOM text; long lines scroll within the focusable code region and wrap for print. NUL and unpaired surrogates are rejected because they cannot round-trip through a UTF-8 HTML file. No code is executed. `CodeBlock` and `codeLimits` are exported for library callers.
- `comparison`: nonempty `subject`, `fields` (1–50), `items` (1–1,000). A field has unique `key`, `label` and optional `unit`. An item has `name` and `attributes`; only declared field keys may appear. Values are strings (up to 20,000 characters), finite numbers, booleans or null. Missing/null display “未提供”; zero, false and empty string are preserved. Input field and item order is preserved.
- `insight`: `level` is `info`, `success`, `warning` or `error`; nonempty `text` is limited to 20,000 characters. The level is supplied by the author, not inferred from the text.
- `metrics`: 1–100 items with nonempty `label` and finite numeric `value`; optional `unit`, `comparisonValue` and `comparisonLabel`. A comparison label requires a comparison value; the same unit applies to both. Zero and negative values are preserved. No differences, percentage changes, unit conversion or good/bad judgments are calculated.
- `steps`: optional `title` and 1–200 items, each with nonempty `title` and optional `description` (up to 20,000 characters). Both list/stepper show all content in input order; stepper is a static sequence, not a wizard or progress tracker. Auto favors stepper for 2–5 short steps, otherwise list; compatible overrides can select either.
- `timeline`: optional `title` and 1–200 items with `time`, `title`, optional `description`. Time is nonempty author-provided text, not parsed, normalized, timezone-converted or sorted. The vertical list preserves input order.

## Inline content

`richtext.content` contains 1–1,000 flat runs. A run's `text` is escaped literal text, including whitespace and line breaks. Optional `marks` is a nonempty array of unique `strong`, `emphasis` and/or `code` values. These can combine on the same run; rendering nests link → strong → emphasis → code, independent of mark order. Optional `href` follows the same URL and existing-fragment rules as source URLs. Links do not fetch resources during compilation or on page load.

```json
{
  "kind": "richtext",
  "content": [
    { "text": "Read " },
    { "text": "compile()", "marks": ["strong", "code"] },
    { "text": " in the " },
    { "text": "project docs", "href": "https://github.com/CelloCello/semloom" }
  ]
}
```

Limits: each run and the sum of run texts are at most 100,000 Unicode code points; each `href` is at most 4,000 characters. The exported Schema checks per-run length and run count; semantic validation checks the combined text limit, URL policy and fragment existence after all Section/Block/source IDs are resolved. Failures identify the run's JSON pointer. `inlineLimits`, `InlineMark`, `InlineRun` and `RichTextBlock` are exported from `semloom` for library callers.

No nested runs, raw HTML, Markdown parsing, inferred links or inline citations are supported. Use separate richtext blocks for separate paragraphs, and block-level `sourceIds` for evidence. All other existing string fields remain literal, including `prose.text`, comparison values and Plugin fields. See [the complete example](../examples/richtext.json).

## List content

A list group requires `ordered: true` for an ordered list or `false` for an unordered list, plus 1–1,000 items. Each item requires `content` using the same inline runs, limits, URL policy and resolved-fragment checks as Rich Text. Optional `children` is a list group with its own order mode; mixed ordered/unordered nesting is supported. All groups and items retain input order; list items are not document anchors or Override targets.

```json
{
  "kind": "list",
  "ordered": false,
  "items": [
    {
      "content": [{ "text": "Prepare", "marks": ["strong"] }],
      "children": {
        "ordered": true,
        "items": [{ "content": [{ "text": "Validate the input" }] }]
      }
    }
  ]
}
```

Limits: eight list-group levels, including the root, and 1,000 total items per block. The Schema bounds nesting and each group's size; semantic validation checks the total item count and every item's inline content without truncation. A list is a collection, while `steps` describes a sequence of operations with titled steps. `ListContent`, `ListItem`, `ListBlock` and `listLimits` are exported for library callers. The [technical guide](../examples/technical-guide.json) combines nested lists, Rich Text and literal code with block citations.

## References

Document `sources` is optional. A source has unique `id`, plain `title`, optional absolute HTTP(S) `url` or an existing document fragment. Credentials, whitespace/control characters and other schemes are rejected. No URL is fetched during build or on report load.

Block `sourceIds` is optional and ordered; dangling/duplicate references fail. Sources without URLs and unused sources still appear in the ordered source list. Core displays “本區塊來源” beneath the block for every variant. This does not prove individual cells or sentences.

The exported schema validates structure. Uniqueness across nodes, total node counts, field-key relationships, safe/existing URLs and reference targets are additional semantic checks performed by both `validate` and `build`.

## Presentation config

Config accepts registered `theme`/`layout` IDs, optional `themes`/`layouts` arrays of explicit local JSON manifests, an `overrides` object and a `plugins` array of explicit local `.js`/`.mjs`/`.cjs` paths. Defaults remain `minimal`/`document`; built-in names continue working. Registration paths resolve from the config directory. Schema export, validate, build and list use the same Registry and presentation catalog. Theme changes appearance; the Layout base participates in context. See [Themes and Layouts](themes.md) and [external manifests](presentation-authoring.md).

Each override maps an explicit block ID to a compatible full Variant ID: `comparison.cards`, `comparison.table`, `prose.paragraph`, `richtext.paragraph`, `list.nested`, `code.block`, `insight.callout`, `metrics.summary`, `steps.list`, `steps.stepper`, `timeline.vertical`, or a loaded Plugin contribution. Unknown targets, sections, automatic IDs and unsupported selections are errors. No permissive fallback is provided. See [Plugin authoring](plugin-authoring.md) for registration, compatibility and assets.

Config also accepts `interactive: boolean` (default `false`). Build flags `--interactive` / `--no-interactive` override a valid config; supplying both is an error. This flag does not alter semantic validation, build-time selection or the initial static content. The browser selector contains only supported Variants with adapters, including low-score compatible ones; fewer than two candidates produces no selector or switching payload. Runtime data contains resolved block IDs and the same validated content, frozen against adapter mutation. Block sources remain outside the replaceable View. See [interactive reports](interactive.md).
