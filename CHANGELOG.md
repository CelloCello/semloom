# Changelog

## Unreleased

- Add Rich Text, nested List and literal Code blocks, with validated inline links, preserved code whitespace and public types/limits. Existing plain-text fields remain literal.
- Support external Theme/Layout manifests and Library catalogs, including a right-side TOC example and `layouts list`.
- Add hierarchy tree and offline Markmap views with node folding, Theme-specific six-color palettes and complete no-JS/print fallback.
- Ship initial/edit examples for tool comparison, technical instructions and architecture grouping.
- Preserve legacy typed `Config` objects without presentation registrations, and protect loaded files from CLI output through symlink aliases.

## 0.1.0-alpha.1 — release candidate

- Semantic JSON compilation for prose, comparison, insight, metrics, steps and timeline; plain-text content and block-level source references.
- Build-time Auto, Override and Explain; comparison cards/table and steps list/stepper.
- Minimal/editorial Themes and document/sidebar Layouts, with offline navigation and print styles.
- Ocean, Graphite, Signal and Midnight Themes; dark native controls and a complete light print palette for every Theme.
- Trusted local Plugins with effective Schema export, version/dependency checks and CSS asset deduplication.
- Optional offline comparison switching through browser adapters, including rollback and View resource cleanup.
- ESM library and browser-safe exports, CLI, packed examples and authoring documentation.
- Bundled Semloom Agent skill with checkout/installed-package workflows, dynamic Schema guidance and project-local installation instructions.
- Separate Node-only compiler/data declarations and browser DOM declarations under `semloom/browser`.
- Clean package builds and installed-tarball smoke verification, including Plugin/browser entry resolution outside the source checkout.
- MIT license, copyright 2026 Semloom contributors.

This candidate is prepared for distribution as a GitHub Release tarball; it has not been published by this repository change. It supports Node 22.14+ within 22.x and Node 24.x. Plugin API, data and package versions have separate responsibilities; see the release guide.
