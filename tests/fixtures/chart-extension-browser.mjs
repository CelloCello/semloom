import { htmlView, html } from '../../dist/browser/index.js';
export function one() {
  return htmlView(html`<p>Extension one</p>`);
}
export function two() {
  return htmlView(html`<p>Extension two</p>`);
}
export function fail() {
  throw new Error('Deliberate test failure.');
}
