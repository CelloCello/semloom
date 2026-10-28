import type { HtmlFragment } from '../core/types.js';

const fragments = new WeakSet<object>();
export function fragment(value: string): HtmlFragment {
  const result: HtmlFragment = { value, __safeHtml: true };
  fragments.add(result);
  return result;
}
export function isFragment(value: unknown): value is HtmlFragment {
  return typeof value === 'object' && value !== null && fragments.has(value);
}

export function escape(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): HtmlFragment {
  const result = strings.reduce(
    (result, part, i) =>
      result +
      templateLiteral(part) +
      (i < values.length ? interpolate(values[i]) : ''),
    '',
  );
  return fragment(result);
}
function templateLiteral(part: string): string {
  // Normalize authored markup indentation, never the interpolated user strings.
  // Otherwise formatting templates would add visible spaces under pre-wrap.
  if (part.trim() === '') return part.includes('\n') ? '' : part;
  return part
    .replace(/>[\t ]*\r?\n\s*</gu, '><')
    .replace(/>[\t ]*\r?\n[\t ]*$/u, '>')
    .replace(/^[\t ]*\r?\n[\t ]*</u, '<');
}
export function heading(
  level: number,
  text: string,
  id?: string,
): HtmlFragment {
  const tag = Math.min(Math.max(level, 2), 6);
  return fragment(
    `<h${tag}${id === undefined ? '' : ` id="${escape(id)}"`}${level > 6 ? ` aria-level="${level}"` : ''}>${escape(text)}</h${tag}>`,
  );
}
function interpolate(value: unknown): string {
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (isFragment(value)) return value.value;
  return escape(value);
}
