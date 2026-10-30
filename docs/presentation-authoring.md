# External Themes and Layouts

Themes change tokens and component appearance; Layouts arrange existing page regions. Register local JSON manifests and select their IDs independently, without editing or rebuilding Semloom. See the [working config](../examples/presentation/presentation.json):

```json
{
  "themes": ["./paper.json", "./night.json"],
  "layouts": ["./right-sidebar.json"],
  "theme": "example.paper",
  "layout": "example.right-sidebar"
}
```

```sh
pnpm semloom themes list --config examples/presentation/presentation.json
pnpm semloom layouts list --config examples/presentation/presentation.json
pnpm semloom build examples/technical-guide.json --config examples/presentation/presentation.json -o reports/right-sidebar.html
pnpm semloom build examples/technical-guide.json --config examples/presentation/presentation.json --theme example.night -o reports/right-sidebar-dark.html
```

Installed consumers use `semloom` or `npx --no-install semloom` with their own files. Use the same config for `schema`, `validate` and `build`. Every entry validates all registered definitions, including unused ones; an invalid config selection is rejected before CLI overrides. Listings return built-in names followed by sorted external IDs.

## Reading preset

Build the [illustrative weekly report](../examples/reading-report.json) with the [reading config](../examples/reading-presentation.json):

```sh
pnpm semloom build examples/reading-report.json --config examples/reading-presentation.json -o reports/reading/report.html
pnpm semloom build examples/reading-report.json --config examples/reading-presentation.json --theme minimal --layout document -o reports/reading/baseline.html
```

Both commands use the same content and explicit Variants. External `example.reading` supplies gray/navy/blue styling and local system fonts; independent `example.paper-sidebar` places a Theme surface behind the title, content and footer. It inherits sidebar's single TOC, mobile disclosure, keyboard behavior and no-JS navigation, and works with built-in Themes. Copy the config, manifests and referenced CSS together; these IDs require registration.

The config selects `comparison.responsive` for `changes-comparison`: a table above 760px, one-column cards at 760px and below, and a table in print. CSS exposes one complete representation at a time without JavaScript; embedding both increases HTML size. Core renders citations once. Auto retains its cards/table choices; interactive reports also offer “自適應”.

Metrics, insights and steps reuse existing kinds. Mindmap keeps offline Markmap, six branch colors and the complete no-JS/print tree. Example progress and values are fictional.

## Manifest contracts

Theme fields: `id`, `themeApiVersion: "1.0"`, optional `tokens`, optional `cssFile`. Layout fields: `id`, `layoutApiVersion: "1.0"`, `base: "document" | "sidebar"`, optional `cssFile`. IDs are 1–100 lowercase letters, digits, dots and hyphens, starting with a letter. Prefer names such as `example.paper`. Duplicate/reserved IDs, unknown fields and unsupported versions fail. Theme and Layout namespaces and API versions are separate from each other and from package/Document/Plugin versions.

Paths must be absolute local paths or start with `./` or `../`. Manifest paths resolve from the config; CSS paths resolve from the manifest. Manifests must be `.json`, valid UTF-8 and at most 1,000,000 bytes; CSS files are at most 200,000 bytes. Nothing is downloaded, discovered, installed or executed as Theme/Layout JavaScript. Output cannot overwrite loaded manifest/CSS files.

The [paper Theme](../examples/presentation/paper.json) combines partial tokens and CSS; [night](../examples/presentation/night.json) uses tokens only. Missing values inherit minimal defaults. Accepted token values are bounded:

| Tokens                                                                       | Values                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| paper, surface, ink, muted, accent, line, table-head, table-hover, selection | Hex colors with 3, 4, 6 or 8 digits.                                                               |
| space, radius, measure                                                       | Nonnegative px/rem/em/ch/vw/vh/% lengths or unitless zero; at most 40 characters.                  |
| font-body, font-heading                                                      | Local font-family lists including quoted names; at most 500 characters.                            |
| body-leading                                                                 | Unitless strings starting with 1–3, optionally followed by a decimal point and up to three digits. |
| title-weight                                                                 | Numeric strings 100–900, including 650.                                                            |
| color-scheme                                                                 | `light` or `dark`.                                                                                 |

Use optional CSS for additional visual rules. CSS follows the offline asset subset: no imports, URLs/network functions, escapes, comments or style terminators. Syntax errors/warnings from the bundled CSS parser fail validation. This is not a guarantee that arbitrary author styles are readable or accessible. Scope rules with `[data-theme='example.paper']` or `[data-layout-id='example.right-sidebar']`, use shared variables, and verify contrast, content visibility and focus access.

## Layout identity and behavior

The [right-sidebar manifest](../examples/presentation/right-sidebar.json) uses the `sidebar` base. Its [CSS](../examples/presentation/styles/right-sidebar.css) moves navigation to the right above 800px; mobile retains the base disclosure and keyboard/focus behavior. No-JS and initialization failure preserve a static TOC. Core owns headings, content order, IDs, citations, sources, skip link, navigation markup and runtime. This API does not add arbitrary regions, HTML templates, semantic reordering or custom JavaScript.

Root HTML keeps `data-layout="sidebar"` and adds `data-layout-id="example.right-sidebar"`. Plugins, Explain's `plan.context.layout` and browser adapters receive the base name. Theme never enters that context. Changing Theme preserves document and Plan; changing Layout may affect a Plugin's base compatibility.

Cascade: tokens/Core styles → selected Plugin CSS → selected external Theme CSS → selected external Layout CSS → final Core print palette/page-flow resets. Built-in-only composition remains unchanged. Print uses a light palette and single column; final resets cannot undo every arbitrary author rule.

## Library APIs

Existing `compile(input, options, registry?)` calls continue working. File loading is explicit and async; pass its catalog as the optional fourth argument, leaving the third argument for the content Registry:

```js
import { compile, parseConfig, loadPresentation } from 'semloom';

const config = parseConfig({
  themes: ['./paper.json'],
  layouts: ['./right-sidebar.json'],
  theme: 'example.paper',
  layout: 'example.right-sidebar',
});
const catalog = await loadPresentation(config, '/absolute/report-directory');
const result = compile(input, config, undefined, catalog);
```

`Config` keeps registration arrays optional for existing typed callers; `parseConfig()` returns `NormalizedConfig` with both arrays populated. `parseConfig()` validates shape and built-in selections; file-backed names are checked against the loaded catalog. Use `parseConfig(raw, catalog.names())` for full selection validation after loading. `compile()` rechecks names, rejects unresolved file registrations without a catalog, stays synchronous and never implicitly loads presentation files. Direct `planDocument()` callers pass the resolved base as its optional fourth argument for external Layouts.

Application-owned definitions use `createPresentation({ themes, layouts })`. They accept inline `css` text instead of `cssFile`; unresolved file fields fail. Public types include `ThemeDefinition`, `LayoutDefinition`, `ThemeTokens`, `ResolvedPresentation` and `PresentationNames`. Catalogs clone inputs and returned definitions; caller mutation does not change registrations.

```js
import { compile, createPresentation } from 'semloom';

const catalog = createPresentation({
  themes: [
    { id: 'my.paper', themeApiVersion: '1.0', tokens: { accent: '#345678' } },
  ],
  layouts: [
    {
      id: 'my.reading',
      layoutApiVersion: '1.0',
      base: 'document',
      css: '.page{max-width:60rem}',
    },
  ],
});
const result = compile(
  input,
  { theme: 'my.paper', layout: 'my.reading' },
  undefined,
  catalog,
);
```

Verify definitions with relevant bases, old/new kinds, Plugin/comparison switching, desktop/375px, keyboard/resize, offline/no-JS and print before sharing them.
