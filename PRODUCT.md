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

CLI or library build; direct `file://` reading, offline use, desktop/375px and print. Twelve built-in kinds cover prose, rich text, nested lists, code, comparisons, insights, metrics, ordered steps, timelines, hierarchies, charts and diagrams; trusted local modules can add kinds and Variants through the shared Registry.

## Capabilities and Constraints

Bundled [report workflows](examples/report-workflows/README.md) cover tool comparison, technical instructions and architecture grouping, each with a fixed initial document, a bounded edit and independent presentation configs. They illustrate the authoring contract rather than recording an Agent run or establishing performance advantages.

External presentation uses explicitly configured local JSON manifests: Theme tokens/optional CSS and Layout base/CSS are independent. Layouts retain the document/sidebar frame, Core navigation and citations; the right-side TOC example inherits sidebar mobile behavior. No Theme/Layout JavaScript or arbitrary HTML renderer is loaded.

Lists support mixed ordered/unordered groups with bounded nesting and shared inline runs. Code blocks retain literal text and whitespace, including CRLF, with local scrolling and print wrapping; language labels do not execute or highlight code.

Hierarchy content describes one bounded tree with plain-text node labels and ordered children. The default tree and explicitly selected mindmap preserve the same relationships and citations. Mindmap uses the real `markmap-view` renderer, bundled into the offline HTML, with mouse/keyboard node folding. Each built-in Theme supplies a matching six-color branch palette. Every screen width retains the diagram with local scrolling; zoom and pan are disabled. No-JS, initialization failure and print retain a complete semantic tree regardless of folding. Nodes are content inside a block, separate from Sections and the TOC.

Charts accept controlled, ordered numeric data for grouped vertical/horizontal bars, lines with explicit gaps for missing values and single-series donuts. Every chart includes complete static SVG and a data table. Default `chart.svg` bundles one offline ECharts reader runtime per report, independently of the `interactive` Variant-switching flag; `chart.static` omits that runtime. Successful enhancement adds safe tooltips and keyboard-operable series legends, retaining at least one visible series and the scale computed from all data. Donut legends remain read-only. Stable keys distinguish repeated labels without changing the displayed text or order. Each Theme owns six chart colors independently of hierarchy branch colors.

Diagrams use Pele to render a restricted Mermaid subset: flowchart, sequence, class, ER and state. The static `diagram.svg` includes the author's description and exact source, with separate wide, narrow and print layouts and no browser diagram runtime. Narrow/print layouts may change direction unless `preserveDirection` is true; styling overrides, callbacks and external resources are rejected during validation. Charts and diagrams use named, focusable local scroll regions rather than shrinking text to fit. Print retains complete chart data and diagram source without JavaScript; bar charts split contiguous categories into readable panels with every series and a shared full-data scale, independently of temporary reader legend choices. Content that cannot fit the readable paper budget produces a layout diagnostic.

Existing text fields remain literal. The explicit `richtext` kind adds bounded inline runs with emphasis, code and validated links, without parsing Markdown or raw HTML. Citations stay at block level and presentation selection happens at build time. Optional `interactive` reports allow offline switching among compatible Variants with browser adapters; Variant switching is disabled by default. HTML must preserve data and sources, escape input and remain readable without JavaScript. Failed Views retain the prior content; successful switches dispose prior resources. Performance/token advantages require controlled evaluation rather than inference from individual reports.

Minimal, editorial, ocean, graphite, signal and midnight Themes combine with document/sidebar Layouts. Midnight is an explicitly selected dark Theme; printing uses a light palette. Theme changes only appearance; sidebar and Scroll Spy enhance navigation while static content and the complete TOC remain available without JavaScript. Research comparison and illustrative PR daily Demos show the authoring-to-reading workflow.
