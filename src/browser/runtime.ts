import type {
  BrowserAdapter,
  BrowserContext,
  BrowserView,
  InteractiveBlock,
} from './types.js';
import { reportMessages } from '../core/report-messages.js';

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}

function createView(adapter: BrowserAdapter, entry: InteractiveBlock) {
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  let view: BrowserView | undefined;
  let disposed = false;
  function release(): boolean {
    if (disposed) return true;
    disposed = true;
    let ok = true;
    controller.abort();
    try {
      view?.dispose();
    } catch {
      ok = false;
    }
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch {
        ok = false;
      }
    }
    return ok;
  }
  const context: BrowserContext = {
    ...entry.context,
    signal: controller.signal,
    onDispose(cleanup) {
      if (typeof cleanup !== 'function') throw new Error('Invalid cleanup.');
      if (disposed) cleanup();
      else cleanups.push(cleanup);
    },
  };
  try {
    view = adapter(entry.data, context);
    if (
      !view ||
      !(view.element instanceof HTMLElement) ||
      view.element.isConnected ||
      typeof view.dispose !== 'function'
    )
      throw new Error('Expected a detached View and dispose().');
    return { element: view.element, release };
  } catch (error) {
    release();
    throw error;
  }
}

export function enhanceVariants(adapters: Map<string, BrowserAdapter>) {
  let entries: InteractiveBlock[];
  try {
    if (typeof AbortController !== 'function') return;
    entries = JSON.parse(
      document.getElementById('semloom-interactive-data')!.textContent!,
    ) as InteractiveBlock[];
    if (!Array.isArray(entries)) return;
    freeze(entries);
  } catch {
    return;
  }
  const releases: (() => boolean)[] = [];
  for (const entry of entries) {
    const block = document.getElementById(entry.id);
    const controls = block?.querySelector<HTMLElement>('[data-switcher]');
    const select = controls?.querySelector<HTMLSelectElement>('select');
    const host = block?.querySelector<HTMLElement>('[data-view-host]');
    const error = block?.querySelector<HTMLElement>('[data-switch-error]');
    if (!block || !controls || !select || !host || !error) continue;
    try {
      if (
        entry.candidates.length < 2 ||
        entry.candidates.some((id) => typeof adapters.get(id) !== 'function')
      )
        continue;
      let selected = entry.selected;
      let release = () => true; // The initial server-rendered View has no browser resources.
      select.value = entry.candidates.includes(selected) ? selected : '';
      select.addEventListener('change', () => {
        const next = select.value;
        if (next === selected) return;
        if (!entry.candidates.includes(next)) {
          select.value = entry.candidates.includes(selected) ? selected : '';
          return;
        }
        let incoming: ReturnType<typeof createView> | undefined;
        try {
          incoming = createView(adapters.get(next)!, entry);
          host.replaceChildren(incoming.element);
        } catch {
          incoming?.release();
          select.value = entry.candidates.includes(selected) ? selected : '';
          error.textContent = reportMessages(entry.context.locale).switchFailed;
          error.hidden = false;
          select.focus({ preventScroll: true });
          return;
        }
        const previous = release;
        release = incoming.release;
        selected = next;
        block.dataset.variant = next;
        error.textContent = '';
        error.hidden = true;
        if (!previous()) {
          error.textContent = reportMessages(
            entry.context.locale,
          ).cleanupFailed;
          error.hidden = false;
        }
        select.focus({ preventScroll: true });
        window.dispatchEvent(new Event('semloom:viewchange'));
      });
      releases.push(() => release());
      select.disabled = false;
      controls.hidden = false;
    } catch {
      controls.hidden = true;
      select.disabled = true;
    }
  }
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) for (const release of releases) release();
  });
}
