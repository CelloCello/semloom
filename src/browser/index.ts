import type { HtmlFragment } from '../core/types.js';
import type { BrowserView } from './types.js';
import { isFragment } from '../html/html.js';

export { html, heading } from '../html/html.js';
export { safeUrl } from '../core/url.js';
export type { BrowserAdapter, BrowserContext, BrowserView } from './types.js';
export type { Block } from '../core/types.js';

// Browser-only entry: no compiler, Registry, filesystem or Node renderer imports.
export function htmlView(content: HtmlFragment): BrowserView {
  if (!isFragment(content)) throw new Error('Expected an HtmlFragment.');
  const template = document.createElement('template');
  template.innerHTML = content.value;
  const element = template.content.firstElementChild;
  if (
    !(element instanceof HTMLElement) ||
    template.content.children.length !== 1 ||
    [...template.content.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    )
  )
    throw new Error('A browser View must have one HTMLElement root.');
  return { element, dispose() {} };
}
