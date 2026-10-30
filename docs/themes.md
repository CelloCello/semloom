# Themes and Layouts

Built-in Themes are `minimal`, `editorial`, `ocean`, `graphite`, `signal` and `midnight`; Layout bases are `document` and `sidebar`. Defaults are `minimal`/`document`. Config can also register local JSON Theme/Layout manifests and select their IDs. See [external presentation authoring](presentation-authoring.md) for tokens, CSS, paths, Library APIs and the right-side TOC example. CLI options override valid config selections.

`minimal` uses warm white, green links and local system sans fonts. `editorial` uses warm paper, brown links and local Georgia/Songti/PMingLiU serif fonts, with wider spacing and leading. Font availability depends on the reading machine; nothing is downloaded.

| Theme       | Appearance and reading rhythm                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `minimal`   | Warm white, green accent, system sans, 1.75 leading, 12px corners.                                                  |
| `editorial` | Warm paper, brown accent, local serif, 1.9 leading, 12px corners.                                                   |
| `ocean`     | Cool white, navy text and sea-blue accent, system sans, 1.8 leading, 6px corners.                                   |
| `graphite`  | Neutral white and charcoal, stronger title weight, system sans, compact 1.6 leading, 2px corners.                   |
| `signal`    | White, near-black text and brick-red accent, stronger title weight, system sans, 1.7 leading, 2px corners.          |
| `midnight`  | Deep blue-gray paper, lighter dark surfaces, soft-white text and cyan links, system sans, 1.8 leading, 6px corners. |

Use `pnpm semloom themes list` to list supported names. Config examples live in [ocean](../examples/themes/ocean.json), [graphite](../examples/themes/graphite.json), [signal](../examples/themes/signal.json) and [midnight](../examples/themes/midnight.json):

From a checkout, `pnpm demo:themes` generates every registered Theme/Layout combination and an offline preview index at `reports/themes/index.html`. It uses the same research input for all combinations; see the [examples guide](../examples/README.md).

```sh
pnpm semloom build examples/comparison.json --config examples/themes/ocean.json -o reports/ocean.html
pnpm semloom build examples/comparison.json --theme midnight --layout sidebar --interactive -o reports/midnight.html
```

Theme selection is explicit at build time, including `midnight`; there is no OS-preference detection or in-report Theme switch. Midnight sets the native control color scheme to dark. Printing every Theme restores light paper, white component surfaces, black text/links and neutral table colors; Theme fonts and reading rhythm remain. The Theme accent does not change an insight's author-supplied level or imply a factual judgment.

## Tokens and components

For full reports rather than isolated components, use the [initial/edit workflows](../examples/report-workflows/README.md). Their configs register paper/night Themes and the right-side TOC independently; build flags can choose a registered Theme or a built-in Layout without editing semantic JSON.

Styles are organized by responsibility:

```text
src/html/
  themes/
    minimal.ts       # Complete baseline tokens and ThemeTokens type
    editorial.ts     # Partial token overrides
    ocean.ts         # Cool blue reading palette
    graphite.ts      # Compact neutral palette
    signal.ts        # Strong titles and brick-red accent
    midnight.ts      # Dark surfaces and native color scheme
    index.ts         # Built-in Theme map, fallback resolution, token CSS and print palette
  styles/
    components.ts    # Shared typography, content components and navigation controls
    index.ts         # Stylesheet composition and cascade order
  layouts/
    document.ts      # Default page flow, mobile spacing and shared print flow
    sidebar.ts       # Desktop sidebar and mobile disclosure layout
```

`themes/index.ts` merges the baseline with a Theme's overrides before emitting CSS variables, so omitted keys retain a complete value. It contains no component or Layout rules. `styles/index.ts` combines Theme CSS, shared components, the default document frame, sidebar overrides and finally print Layout resets. Component rules keep their own mobile/print styles; both Layouts return to document flow in print. The renderer embeds the combined CSS before selected Plugin assets. Keep values authored and static; never interpolate document data into CSS.

To add a built-in Theme:

1. Add its name to `themeNames` in `src/core/types.ts`. Config Schema and CLI listing use this shared list.
2. Create `src/html/themes/<name>.ts` with token overrides and a six-color `MindmapPalette`. For example:

   ```ts
   import type { ThemeTokens, MindmapPalette } from './minimal.js';

   export const customTokens: Partial<ThemeTokens> = {
     paper: '#f4f7fa',
     accent: '#285e85',
   };
   export const customMindmapPalette: MindmapPalette = [
     '#246d98',
     '#247f89',
     '#4c729d',
     '#53688f',
     '#437e70',
     '#6d6f97',
   ];
   ```

3. Import and register `{ tokens, mindmap }` in the `themes` map in `themes/index.ts`. No component or Layout edits are needed for an existing token change. A new token also needs a baseline value and the rules that consume it.
4. Update CLI help, docs/design tokens and tests; rebuild and verify all supported Layouts, mobile/print, contrast and unchanged content/Variant selection.

Built-in Themes are explicitly registered source modules. External Themes use explicitly configured JSON manifests; neither route discovers files automatically. External presentation is separate from content Plugins.

| Variables                                  | Use                                      |
| ------------------------------------------ | ---------------------------------------- |
| `--paper`, `--surface`, `--ink`, `--muted` | Page, block backgrounds and text         |
| `--accent`, `--line`, `--selection`        | Links/focus, rules and text selection    |
| `--space`, `--radius`, `--measure`         | Group spacing, corners and prose measure |
| `--font-body`, `--font-heading`            | Local font stacks                        |
| `--body-leading`, `--title-weight`         | Reading rhythm and title weight          |
| `--table-head`, `--table-hover`            | Table and navigation states              |
| `--color-scheme`                           | Native control appearance, light or dark |

Plugin CSS should consume these variables, with fallbacks when helpful, and inherit the native color scheme. The [example Plugin](../examples/comparison-plugin/index.mjs) works with all built-in Themes. Hardcoded light backgrounds or text colors in third-party Plugins are not automatically recolored. Theme is not passed to `supports`, `score` or `render`; changing only Theme preserves the resolved document, Presentation Plan and body/navigation markup. Layout is part of presentation context, so a Plugin may use it for compatibility or scoring. A Theme cannot substitute for a Variant or rewrite data.

## Navigation and focus

Layout is chosen at build time, with priority CLI option → config → `document` default. It is not inferred from content or Theme. The renderer sets `data-layout`; `layouts/document.ts` supplies the shared frame and `layouts/sidebar.ts` overrides it for sidebar. To add another built-in Layout, extend `layoutNames`, add its CSS to `layouts/` and stylesheet composition, and update the renderer/navigation only if it needs different structure or controls. Validate all Themes and the responsive/no-JS/print behavior together.

All Themes share a bordered TOC card using their ink, background, line and radius tokens. Its title is “目錄與資料來源” when sources exist, otherwise “目錄”; a separate “資料來源” link leads to the Core source list. `document` places the full card above content. `sidebar` uses a permanent, independently scrollable desktop card. At widths up to 800px it becomes an in-flow disclosure: a fixed title and triangle indicate its expanded state, and the button/links share one visual frame. It is never a modal and does not trap focus. Every Section, up to eight levels deep, has a TOC anchor; IDs are encoded in links and looked up directly rather than interpolated into selectors.

With JavaScript disabled, the disclosure button stays hidden and the complete card remains visible. The fixed inline navigation script enables the button and sets `aria-current="location"` on the current Section or source link. Enter/Space opens the mobile TOC, Tab reaches links, Escape closes it and returns focus to the button. Activating a TOC link moves focus to its heading, including the source heading. Resizing from desktop to mobile moves a focused TOC link to the visible button before hiding the list. A skip link leads to the main content.

No navigation selection is saved between openings. Initialization failure restores the visible static TOC. The CSP authorizes the exact navigation script hash; content is never embedded in that script. The script makes no requests and reads no storage. Optional [interactive reports](interactive.md) add a separately hashed adapter bundle and a safely encoded data payload. Switching preserves the TOC, section anchors and mobile disclosure state. Its Theme-aware control styles live in `styles/interactive.ts` and are included only when switching is available.

At 375px the page fits the viewport; wide tables scroll in their own focusable region. Print removes the TOC, button and footer, restores one column, wraps table cells and retains all content/citations with source URLs. Print CSS cannot guarantee identical pagination across browsers or installed fonts.

## Hierarchy

Hierarchy tree labels consume `--surface`, `--ink`, `--line`, `--radius` and `--body-leading`. The real Markmap renderer inherits Theme fonts, ink, paper and leading through its CSS variables, with colored underlines, curves and folding circles. `.semloom-mindmap-diagram` is a locally scrollable region at every screen width; narrowing the viewport does not switch it to a list. A full `.semloom-hierarchy-tree[data-mindmap-fallback]` remains available for no-JS, setup failure and print. Keep the fallback complete and check long labels with both Layout bases. Nodes do not add TOC entries: only Sections do. The [mindmap config](../examples/hierarchy-mindmap.json) combines this content with external paper/night Themes and the right-side TOC Layout.

### Hierarchy branch colors

The root underline uses `--accent`; text uses `--ink` and Theme fonts/leading. Each built-in Theme supplies its own six-color palette. Main branches repeat these colors in input order; descendants retain their main branch color. All built-in branch colors have at least 3:1 contrast against their Theme's paper and surface. Text remains in the readable ink color.

Palettes use separated hues as well as background contrast. Unit checks require a minimum pairwise OKLab distance of 0.08; this is a design regression guard, not a guarantee of distinction for every kind of color vision. Graphite keeps neutral page colors but uses restrained colored branches. Branch labels and geometry remain the primary cues.

| Theme       | Palette character        | Branches 1–6                                                     |
| ----------- | ------------------------ | ---------------------------------------------------------------- |
| `minimal`   | Natural, clear hues      | `#237747`, `#2463b5`, `#ad590f`, `#8545b3`, `#b3374f`, `#857000` |
| `editorial` | Warm pigment accents     | `#a4491f`, `#947000`, `#47742f`, `#b03758`, `#7945a1`, `#137881` |
| `ocean`     | Blue-led mixed hues      | `#176ea5`, `#00806b`, `#b45b15`, `#7a49b4`, `#52762b`, `#b43a69` |
| `graphite`  | Restrained color accents | `#356c50`, `#3c65a1`, `#925b20`, `#76519a`, `#9e4252`, `#808400` |
| `signal`    | Strong, clear colors     | `#c43c29`, `#b56c00`, `#748300`, `#1b835a`, `#246cd0`, `#9546bd` |
| `midnight`  | Bright on dark surfaces  | `#43c6e6`, `#65d28c`, `#f5b544`, `#b897ff`, `#ff7a9b`, `#80abff` |

External Themes inherit Minimal's palette, or Midnight's when their existing `color-scheme` token is `dark`. Override any subset of `--semloom-mindmap-branch-1` through `--semloom-mindmap-branch-6` in a Theme's **CSS**, scoped to its ID. Omitted colors retain the inherited value. These are component CSS custom properties, not additional manifest `tokens` keys; check contrast against your own backgrounds after overriding. For example:

```css
[data-theme='example.paper'] .semloom-hierarchy-mindmap {
  --semloom-mindmap-branch-1: #bc6918;
  --semloom-mindmap-branch-2: #527d3e;
  --semloom-mindmap-branch-3: #b34949;
}
```

Color identifies branches; it conveys no ranking or factual judgment. Plain text remains readable independently of color. Print uses the complete fallback tree and Core print palette, regardless of which nodes the reader folded. The [paper CSS example](../examples/presentation/styles/paper.css) includes these overrides. Markmap's `.markmap-node` and `.markmap-link` belong to the renderer; Semloom does not manually join HTML borders to its curves.
