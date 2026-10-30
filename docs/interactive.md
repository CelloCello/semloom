# Interactive reports

This page describes optional **Variant switching**. The selected built-in `hierarchy.mindmap` separately includes an offline Markmap enhancement with node folding, even when `interactive` is false. Its no-JS, setup-failure and print output is the complete hierarchy tree. Choose `hierarchy.tree` for an entirely static hierarchy without that runtime. See the [hierarchy contract](semantic-schema.md#hierarchy-content).

Set `interactive: true` in config or use `build --interactive`. The default is `false`; `--no-interactive` overrides a true config. The compiler still emits the complete build-selected HTML. JavaScript adds optional switching, while no-JS and initialization failure retain the original readable content and citations.

## Candidates and output

Only Variants whose build-time `supports` check passed and which declare a browser adapter become candidates. Score affects the initial Auto selection, not manual eligibility. A block with fewer than two candidates gets no selector or switching data. A static-only selected Variant remains the initial View; the selector starts at a disabled “目前建置版型” placeholder, and that Variant is not offered as a switch target.

Built-in comparison cards/table/responsive have switching adapters. Responsive uses a table above 760px, cards on narrower screens and a table in print; its adaptation also works without JavaScript. It embeds both representations but exposes one at a time. Auto retains its existing cards/table choices. The local example adds comparison rows; its note panel remains static-only. Other kinds have no switching selector unless a Plugin supplies enough compatible adapters. The built-in mindmap enhancement is independent of that selector. `plugins list` reports declared `browserVariants`, not every built-in enhancement, per-document compatibility or proof that an entry bundles successfully.

Switching adds one bundle for the report and one JSON payload covering only switchable blocks. Adapters and shared local dependencies are bundled once by module identity. Candidate Variants are rendered on demand; the responsive Variant itself contains both CSS-controlled representations. A selected built-in mindmap has its separate enhancement bundle/payload. CSS includes selected static and all eligible candidate assets under the existing ID/content-hash/dependency rules. Each executable bundle receives a SHA-256 CSP authorization. JSON escapes HTML delimiters and line separators and is never interpolated into executable code.

There are no runtime downloads, Agent calls, input/config writes or saved choices. Reopening/reloading starts at the build selection. Theme, Layout, section IDs, navigation state and Core-owned block citations remain outside the replaced content. Print shows the current complete View and sources, hiding switching controls/errors.

## Adapter manifest

Keep Node registration/rendering separate from browser code:

```js
{
  id: 'example.comparison.rows',
  supports,
  score,
  render,
  assets,
  browser: {
    entry: './browser.mjs',
    exportName: 'createView',
    label: '逐項清單'
  }
}
```

`entry` is an explicit local JS/MJS/CJS/TS path. `loadRegistry` resolves relative browser entries from the declaring Plugin module's directory, while config `plugins` paths resolve from the config directory. With manually constructed Registries, pass absolute browser entry paths. `exportName` must be an identifier; optional `label` is 1–200 plain-text characters and defaults to the Variant ID.

Only required entries are resolved/bundled. Missing files or unresolved ESM exports, Node imports, unresolved external imports, CSS file imports or unsupported bundler warnings fail interactive compilation with `BROWSER_BUNDLE`; malformed paths/metadata fail validation. Dynamic CommonJS exports and factory types are checked during browser setup; invalid factories leave the static View and hidden controls. Static builds do not bundle declared browser entries. Failures preserve existing output. Use browser-compatible static local/package imports, with installed packages bundled into the file. No runtime imports, network APIs, remote assets, dynamic code evaluation, global data mutation or module-level DOM changes are supported. Plugins are trusted code, not sandboxed.

## Browser View and cleanup

```js
import { htmlView } from 'semloom/browser';
import { renderRows } from './templates.mjs';

export function createView(data, context) {
  const view = htmlView(renderRows(data, context));
  const observer = new ResizeObserver(() => {
    // Update only this View if the component needs size-dependent behavior.
  });
  observer.observe(view.element);
  context.onDispose(() => observer.disconnect());
  window.addEventListener(
    'resize',
    () => {
      // View-specific work, if needed.
    },
    { signal: context.signal },
  );
  return view;
}
```

The synchronous factory returns `{ element: HTMLElement, dispose(): void }`. Its element must be detached; template-created elements are supported. Async factories/Promises are unsupported. `data` is the validated block with resolved `id`, original values and `sourceIds`, recursively frozen. `context` provides `locale`, `layout`, `headingLevel`, `signal` and `onDispose(cleanup)`; Theme stays in CSS tokens.

`semloom/browser` exports the browser-safe `html`, `heading`, `htmlView` and `safeUrl` helpers and the `BrowserAdapter`, `BrowserContext`, `BrowserView` types. Those DOM types belong to this subpath; the main compiler/data entry does not require DOM ambient declarations. Use escaping fragments or DOM `textContent`, never raw user HTML. `htmlView` checks the fragment brand and requires one root HTMLElement. `safeUrl` shares the Node-side HTTP(S)/fragment and credential/control-character rules; callers still need to validate fragment targets. Source links and block references should remain Core-owned. Shared pure templates may run on both sides; the compiler never serializes a Node render function. Importing the compiler's main entry into an adapter can pull in Node APIs and will fail bundling.

Register event listeners with `context.signal` and other resources with `context.onDispose` immediately after allocation. These hooks also clean partial construction if the factory throws before returning a View. `dispose()` releases any additional View-owned state; it must be idempotent and must not remove another View or shared document nodes.

## Switching lifecycle

1. Initialize controls against the existing server View; enable/show them only after setup succeeds. Do not replace the initial static DOM just to initialize.
2. Build the requested View while the current View remains connected. Validate the factory result before replacement.
3. On failure, abort the incoming signal and run registered cleanups/disposal. Keep prior DOM, Variant ID, citations and selection, and show a recoverable error. Focus stays at the selector.
4. On success, replace only the content host, then abort/dispose the old View and run its registered cleanups. Each resource owner is released once. Notify navigation to update Scroll Spy without rebuilding it. A disposal error is reported while the successfully committed new View remains usable; other cleanup callbacks still run.

Native select keyboard behavior follows the browser/OS and inherits the Theme's light/dark color scheme. Controls remain in normal Tab order with a visible focus ring and an associated label. Plugin controls inside a replaced View must follow the same keyboard/focus discipline. Verify server/browser content parity, plaintext/URLs, units/order/missing values and citations, all built-in Themes and both Layouts at 375px, offline/no-JS/print, failed construction and repeated teardown; built-in and example tests demonstrate this coverage.
