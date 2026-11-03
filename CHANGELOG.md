# Changelog

## Unreleased

### Added

- Controlled ECharts bar, line and donut charts with complete offline SVG/data tables, keyed reader legends, safe tooltips and pure-static overrides.
- Static Pele flowchart, sequence, class, ER and state diagrams with shared syntax/subset validation, exact source and author descriptions.
- Theme-owned chart palettes, natural narrow layouts, full-data A4 bar panels, readable layout diagnostics and installed-consumer coverage for both kinds.

### Changed

- Reuse the private built-in Registry and compiled validators within a process, with isolated per-Registry document Schemas and editable Schema exports.
- Build once during `pnpm check` while retaining the complete Node and Chromium suites; standalone test commands still build first.

### Fixed

- Evict validators after rejected or throwing validation so cached Ajv error arrays and referenced validators can be collected; successful validations retain reuse.

## 0.1.0 — 2026-10-30

Initial release.

### Added

- Standalone offline HTML from semantic JSON, with ten built-in kinds, block-level source references, navigation and print styles. Rich Text and nested List support validated inline links; Code preserves literal whitespace, and plain-text fields remain literal.
- Build-time Auto, per-block Override and Explain; comparison cards/table and steps list/stepper.
- Six built-in Themes with light print palettes, document/sidebar Layouts, and external Theme/Layout manifests and Library catalogs, including a right-side TOC example.
- An external reading Theme and paper-style sidebar preset, with a ten-kind illustrative report.
- Hierarchy tree and offline Markmap mindmap views, with node folding, Theme-specific six-color palettes and complete no-JS/print fallback.
- Optional offline comparison switching with rollback and View resource cleanup. Opt-in `comparison.responsive` uses desktop tables, mobile cards and print tables; existing Auto selections remain unchanged.
- Traditional Chinese and English report UI, runtime messages and accessible labels, selected through document `locale`, with an explicit Traditional Chinese fallback and unchanged authored content.
- Trusted local Plugins with effective Schema export, version/dependency checks and CSS asset deduplication; CLI and ESM Library exports with separate Node-only and browser declarations.
- Bundled Semloom Agent skill, initial/edit report workflows for comparison, technical instructions and architecture, and installed-package verification.

### Changed

- Unify the TOC card across Themes with matching tokens, a keyboard-accessible source-list entry and a mobile disclosure; desktop sidebars stay open.
- Increase mindmap branch hue separation across all built-in Themes while retaining background contrast.

### Fixed

- Preserve legacy typed `Config` objects without presentation registrations.
- Protect loaded source and presentation files from CLI output overwrites through symlink aliases.

Licensed under MIT. Supports Node 22.14+ within 22.x and Node 24.x. See the [release guide](docs/releases.md) for distribution and versioning.
