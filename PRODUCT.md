# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, Node.js and pnpm; standalone generated HTML/CSS, with no required framework/browser runtime.

## Users

Coding agents authoring technical research and task reports; people reading, comparing and checking those reports locally.

## Product Purpose

Compile structured meaning into consistent reports without asking the agent to write DOM, CSS or JavaScript.

## Operating Context

CLI or library build; direct `file://` reading, offline use, desktop/375px and print. Ten built-in kinds cover prose, rich text, nested lists, code, comparisons, insights, metrics, ordered steps, timelines and hierarchies; trusted local modules can add kinds and Variants through the shared Registry.

## Capabilities and Constraints

External presentation uses explicitly configured local JSON manifests: Theme tokens/optional CSS and Layout base/CSS are independent. Layouts retain the document/sidebar frame, Core navigation and citations; the right-side TOC example inherits sidebar mobile behavior. No Theme/Layout JavaScript or arbitrary HTML renderer is loaded.

Lists support mixed ordered/unordered groups with bounded nesting and shared inline runs. Code blocks retain literal text and whitespace, including CRLF, with local scrolling and print wrapping; language labels do not execute or highlight code.

Hierarchy content describes one bounded tree with plain-text node labels and ordered children. The default tree and explicitly selected mindmap preserve the same relationships and citations. Mindmap uses the real `markmap-view` renderer, bundled into the offline HTML, with mouse/keyboard node folding. Each built-in Theme supplies a matching six-color branch palette. Every screen width retains the diagram with local scrolling; zoom and pan are disabled. No-JS, initialization failure and print retain a complete semantic tree regardless of folding. Nodes are content inside a block, separate from Sections and the TOC.

Existing text fields remain literal. The explicit `richtext` kind adds bounded inline runs with emphasis, code and validated links, without parsing Markdown or raw HTML. Citations stay at block level and presentation selection happens at build time. Optional `interactive` reports allow offline switching among compatible Variants with browser adapters; default is static. HTML must preserve data and sources, escape input and remain readable without JavaScript. Failed Views retain the prior content; successful switches dispose prior resources. Performance/token advantages require controlled evaluation rather than inference from individual reports.

Minimal, editorial, ocean, graphite, signal and midnight Themes combine with document/sidebar Layouts. Midnight is an explicitly selected dark Theme; printing uses a light palette. Theme changes only appearance; sidebar and Scroll Spy enhance navigation while static content and the complete TOC remain available without JavaScript. Research comparison and illustrative PR daily Demos show the authoring-to-reading workflow.
