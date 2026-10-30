# Report interface languages

Set optional `locale` in the semantic document to select built-in report UI text. Theme/Layout choices remain explicit, and built-in Variant scoring stays unchanged:

```json
{
  "schemaVersion": "1.0",
  "locale": "en-US",
  "title": "My report",
  "sections": [
    {
      "title": "Overview",
      "blocks": [{ "kind": "prose", "text": "Original content." }]
    }
  ]
}
```

Build with the usual `semloom build report.json -o report.html` command. Language selection happens at build time; rebuild to change it. There is no browser/OS language detection, in-report language switch or runtime download.

## Resolution and compatibility

| Document locale                                    | Built-in UI                            |
| -------------------------------------------------- | -------------------------------------- |
| Omitted                                            | Traditional Chinese (`zh-TW`)          |
| `en`, `en-US`, `en-GB`, other `en-*`               | English (`en`)                         |
| `zh`, `zh-TW`, `zh-Hant`, other `zh-*`             | Traditional Chinese (`zh-TW`)          |
| Other accepted locales, such as `fr-FR` or `ja-JP` | Traditional Chinese (`zh-TW`) fallback |

Resolution is case-insensitive and uses the primary language subtag. `zh-Hans`/`zh-CN` also fall back to Traditional Chinese; Simplified Chinese is not a separate translation. Existing locale validation is unchanged. Invalid locale syntax still fails validation.

The original locale remains in the document, Plugin/browser context and HTML `lang`; an omitted locale uses `zh-TW` for presentation. HTML `data-ui-locale` records the resolved UI language. Generated controls, labels and accessible names use that language; authored visible text keeps the document language, including in mixed rows such as a translated comparison prefix followed by an original metric value/unit.

## What changes

The dictionary covers navigation/source headings, skip link/footer, block citations, comparison headers/missing values, insight levels, default metric comparison labels, built-in Variant selector labels, switching errors, code-region labels and mindmap descriptions/fold controls. No-JS and print retain the selected language and complete content.

Static HTML, browser adapters and runtime messages share resolution in `src/core/report-messages.ts`. Translations live in `src/core/locales/zh-TW.ts` and `en.ts`, checked against the shared `ReportMessages` type in `types.ts`. They are bundled into the standalone HTML; no separate language files are needed to read it.

Semloom does **not** translate authored titles, text, field labels, units, source titles, metric comparison-label overrides, code or hierarchy labels. Dates, numbers, booleans and raw values keep their existing rendering; no `Intl` formatting is added. Code's `language` field remains a literal syntax label, separate from document `locale`.

Plugins still receive the original `context.locale` and own their rendered text and declared selector labels. Core does not translate Plugin-authored labels. CLI commands/diagnostics, Schema descriptions and Explain reasons are developer output and are outside this report UI dictionary.
