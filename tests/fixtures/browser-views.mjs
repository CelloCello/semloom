import { html, htmlView } from 'semloom/browser';

if (typeof window !== 'undefined')
  globalThis.fixtureModuleLoads = (globalThis.fixtureModuleLoads ?? 0) + 1;

export function renderTracked(data) {
  return html`<div class="fixture-view">
    <p>${data.subject}</p>
    ${data.items.map(
      (item) =>
        html`<p>${item.name}</p>
          ${data.fields.map((field) => html`<p>${field.label}${field.unit ? ` (${field.unit})` : ''}：${Object.hasOwn(item.attributes, field.key) && item.attributes[field.key] !== null ? String(item.attributes[field.key]) : '未提供'}</p>`)}`,
    )}
  </div>`;
}

function track(data, context) {
  const state = (globalThis.fixtureViews ??= {
    created: 0,
    disposed: 0,
    active: 0,
    cleanups: 0,
    events: 0,
    observerHits: 0,
  });
  state.created++;
  state.active++;
  const view = htmlView(renderTracked(data));
  window.addEventListener('fixture-event', () => state.events++, {
    signal: context.signal,
  });
  const observer = new ResizeObserver(() => state.observerHits++);
  observer.observe(view.element);
  context.onDispose(() => {
    observer.disconnect();
    state.active--;
    state.cleanups++;
  });
  return {
    ...view,
    dispose() {
      state.disposed++;
    },
  };
}
export function trackedView(data, context) {
  return track(data, context);
}
export function failedView(data, context) {
  track(data, context);
  throw new Error('simulated partial creation failure');
}
export function brokenDisposeView(data, context) {
  const view = track(data, context);
  return {
    ...view,
    dispose() {
      view.dispose();
      throw new Error('simulated disposal failure');
    },
  };
}
