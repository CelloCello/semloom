import type { HtmlFragment, InlineRun } from '../core/types.js';
import { html } from './html.js';

// Callers supply structurally and semantically validated inline content.
export function renderInline(content: readonly InlineRun[]): HtmlFragment {
  return html`${content.map((run) => {
    let text = html`${run.text}`;
    if (run.marks?.includes('code')) text = html`<code>${text}</code>`;
    if (run.marks?.includes('emphasis')) text = html`<em>${text}</em>`;
    if (run.marks?.includes('strong')) text = html`<strong>${text}</strong>`;
    return run.href === undefined
      ? text
      : html`<a href="${run.href}">${text}</a>`;
  })}`;
}
