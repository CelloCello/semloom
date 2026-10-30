---
name: Semloom minimal
description: A quiet, readable technical report with explicit data and sources.
colors:
  paper: '#faf9f6'
  ink: '#242923'
  muted: '#586255'
  accent: '#285744'
  line: '#d8ddd4'
  surface: '#ffffff'
  ocean-paper: '#f4f8fc'
  ocean-ink: '#20354b'
  ocean-accent: '#245f88'
  graphite-paper: '#fafafa'
  graphite-ink: '#252525'
  graphite-accent: '#424242'
  signal-paper: '#ffffff'
  signal-ink: '#272321'
  signal-accent: '#a23e2c'
  midnight-paper: '#151d2b'
  midnight-surface: '#202c3d'
  midnight-ink: '#e4eaf2'
  midnight-accent: '#7bc6db'
  print-ink: '#000000'
  print-muted: '#333333'
  print-line: '#999999'
typography:
  display:
    fontSize: 'clamp(2rem, 4.4vw, 3.4rem)'
    lineHeight: 1.2
  section:
    fontSize: '1.65rem'
  section-mobile:
    fontSize: '1.4rem'
  comparison:
    fontSize: '1.2rem'
  item:
    fontSize: '1.06rem'
  body:
    fontFamily: 'system-ui, -apple-system, PingFang TC, Microsoft JhengHei, sans-serif'
    fontSize: '1rem'
    lineHeight: 1.75
  navigation:
    fontSize: '.95rem'
  citation:
    fontSize: '.875rem'
  field-label:
    fontSize: '.85rem'
  footer:
    fontSize: '.8rem'
  print-body:
    fontSize: '10pt'
  print-table:
    fontSize: '8pt'
  print-title:
    fontSize: '24pt'
rounded:
  card: '12px'
  control: '4px'
spacing:
  group: '1.5rem'
---

## Overview

The minimal theme follows the product's reading-first, offline brief. A document title, ordinary section headings, a visible TOC and an ordered source list carry hierarchy. No remote fonts, decorative imagery or app-style chrome.

Editorial shares that structure with warm paper (#f7f1e6), ink (#302a23), brown links (#804224) and local Georgia/Songti/PMingLiU serif fonts. Leading rises to 1.9 and group spacing to 1.75rem. Theme tokens are separate from common component styles; omitted values inherit minimal defaults. See [Theme tokens](docs/themes.md).

Ocean, Graphite, Signal and Midnight extend that same report structure. Ocean uses cool white/navy/blue, 1.8 leading and 6px corners. Graphite uses neutral white/charcoal, 1.6 leading, 750 title weight, 1.25rem grouping and 2px corners. Signal uses white/near-black/brick-red, 1.7 leading, 750 title weight and 2px corners. Midnight uses dark blue-gray paper/surfaces, soft-white text and cyan links, 1.8 leading and 6px corners. All four inherit local system sans fonts. Theme choice does not alter the document, navigation or Variant selection; both Layouts work with every Theme.

Source ownership follows those boundaries: `src/html/themes/` owns token definitions and the print palette; `src/html/styles/components.ts` owns shared typography and content/control styles; `src/html/layouts/` owns document/sidebar flow and Layout resets for print. `styles/index.ts` controls composition order, and Plugin-specific CSS remains with its manifest.

Optional switching uses an inline labeled native select, inheriting Theme fonts/colors with a visible focus ring. Its controls stay hidden until initialization succeeds; recoverable errors appear beside the selector while prior content remains readable. `styles/interactive.ts` is included only for reports with switchable blocks. Print hides the controls and runtime errors while retaining the current View and citations.

## Colors

Warm paper and near-black text; green links and focus indicators. One-pixel rules separate groups. Color never encodes factual conclusions.

The default remains minimal. Midnight explicitly sets `--color-scheme: dark`; other Themes inherit light. Controls, hover states, table headers and selection use Theme variables. Print resets every Theme to light color scheme, white page/component surfaces, black text/links and neutral headers/rules. Plugin CSS should consume the same variables and avoid fixed light colors. See `src/html/themes/` for complete palettes and inherited values.

## Typography

Local system fonts support CJK without downloads. Body line height is 1.75; prose measure is 72ch. Display title ranges from 2rem to 3.4rem. Content strings preserve line breaks and wrap long values; no inline Markdown styling.

Rich Text uses the same prose measure and whitespace behavior, with semantic strong/emphasis, underlined links and wrapping inline code. Code uses local monospace fonts at 0.9em, inherits text color and uses the Theme's table-header surface for a quiet background. Existing plain-text fields keep their literal presentation.

## Layout

External Layouts select an existing base and use `data-layout-id` for scoped placement CSS. The right-side TOC example mirrors desktop sidebar placement while retaining its 800px disclosure, static fallback, keyboard/focus and single-column print behavior. External Themes independently provide validated tokens and optional scoped CSS; Core print resets follow them.

Page max width 76rem, desktop padding 4rem/3rem and mobile padding 2rem/1.1rem. Cards collapse to one column below 600px. Tables scroll inside an accessible, focusable region; the page must not scroll horizontally. Print removes navigation and uses wrapping table cells and repeated headers.

Sidebar expands the page to 96rem with a 15rem sticky TOC and a flexible reading column. At 800px and below it becomes an in-flow mobile disclosure; no-JS keeps all links visible. Focus rings, a skip link and an explicit current-section mark support keyboard reading. Deep TOC indentation flattens after three levels. Print restores a single column and hides navigation controls.

All Themes use the same TOC card, inheriting ink, table-hover background, line and radius tokens. With sources its fixed title is “目錄與資料來源” and a separate link leads to the source list; without sources it says “目錄”. Mobile sidebar joins the existing button and navigation visually, with a CSS triangle reflecting `aria-expanded` and no duplicate heading. Desktop sidebar remains open. Section/source navigation shares focus handling and the current-location mark. No-JS or setup failure retains the complete card, and print hides it.

## Elevation & Depth

Flat surfaces, no shadows. Cards use a single border; no nested card decorations.

## Components

Complete [report workflows](examples/report-workflows/README.md) compose these components within the same document frame. Content edits retain unaffected values, field order and source references; Theme/Layout changes retain the content. Long Chinese hierarchy labels wrap, code scrolls locally on screen, and print retains full text with light surfaces.

Lists use native ordered/unordered markers and bounded indentation; each item's text uses the Rich Text measure and inline styles. Code uses a quiet bordered Theme surface with an optional language caption, local monospace fonts and a focusable scrolling region. Screen preserves code whitespace without wrapping; print wraps long lines without altering DOM text. No highlighting, execution controls or copy runtime is added.

Hierarchy tree uses a complete native nested list with bounded indentation and bordered Theme surfaces. Mindmap uses the real Markmap renderer for text underlines, smooth branches and circular junctions. Theme fonts, ink, paper, leading and six branch colors apply; descendants retain their main branch color. Labels wrap at 224px. Native Markmap measures and lays out text, and its junctions fold/unfold via mouse or Enter/Space with accessible button labels, expanded state and focus rings. Animation, zoom and pan are disabled. The SVG uses natural dimensions in a focusable scrolling region, including 701px and 375px; it is never replaced with a list just because the screen narrows. The original full tree stays visible until successful setup, then is hidden from screen reading. No-JS, setup failure and print show that complete tree; print never loses folded descendants. Content nodes remain separate from document headings and navigation.

Each built-in Theme owns six separated mindmap hues suited to its palette; Graphite keeps a neutral page with restrained colored branches. Colors repeat after branch six, while labels and geometry remain independent cues. The renderer reads Theme CSS variables instead of keeping a separate palette. External light Themes inherit Minimal and dark Themes inherit Midnight, based on `color-scheme`; scoped CSS can override individual colors. Values, contrast and color-distance checks live in [Themes](docs/themes.md#hierarchy-branch-colors).

Comparison cards and tables show the same ordered fields. Block citations sit outside the variant. Sources with no URL remain plain text; source links use visible underlines. Focus rings and print URLs preserve access and traceability.

The external reading preset uses a light gray ground, navy text, blue accents and local system fonts. Its independent paper-style sidebar Layout puts one Theme surface behind the title, content and footer. Theme CSS styles existing metrics and insights; the shared TOC card follows the selected Theme in every Layout. Opt-in `comparison.responsive` embeds the same data as a table and cards: CSS exposes cards at 760px and below, a table above, and a table in print, without JavaScript.

Insights use a quiet bordered aside with an explicit author-supplied level label. Metrics use compact definition lists, 1.4rem values and secondary comparison values without derived trend colors. Steps remain complete ordered lists; the stepper spreads short sequences across columns and collapses on mobile/print. Timelines display raw time labels in input order. These components and local Plugin CSS consume the same paper/ink/accent/line/space tokens.
