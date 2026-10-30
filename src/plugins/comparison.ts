import type { Block, ComparisonBlock, RenderContext } from '../core/types.js';
import { heading, html } from '../html/html.js';
import { reportMessages } from '../core/report-messages.js';

export function renderCards(data: Block, context: RenderContext) {
  const block = data as ComparisonBlock;
  const messages = reportMessages(context.locale);
  return html`<div class="comparison">
    ${heading(context.headingLevel, block.subject)}
    <div class="cards">
      ${block.items.map(
        (item) =>
          html`<article class="comparison-card">
            ${heading(context.headingLevel + 1, item.name)}
            <dl>
              ${block.fields.map((field) => {
                const value = valueFor(item.attributes, field.key);
                return html`<div class="attribute">
                  <dt>${field.label}${field.unit ? ` (${field.unit})` : ''}</dt>
                  <dd
                    lang="${value == null ? messages.locale : context.locale}"
                  >
                    ${display(value, context.locale)}
                  </dd>
                </div>`;
              })}
            </dl>
          </article>`,
      )}
    </div>
  </div>`;
}

export function renderTable(data: Block, context?: RenderContext) {
  const block = data as ComparisonBlock;
  const messages = reportMessages(context?.locale);
  return html`<div
    class="table-scroll"
    role="region"
    aria-label="${block.subject}"
    tabindex="0"
  >
    <table>
      <caption>
        ${block.subject}
      </caption>
      <thead>
        <tr>
          <th scope="col" lang="${messages.locale}">${messages.item}</th>
          ${block.fields.map((field) => html`<th scope="col">${field.label}${field.unit ? ` (${field.unit})` : ''}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${block.items.map(
          (item) =>
            html`<tr>
              <th scope="row">${item.name}</th>
              ${block.fields.map((field) => {
                const value = valueFor(item.attributes, field.key);
                return html`<td
                  lang="${value == null ? messages.locale : (context?.locale ?? 'zh-TW')}"
                >
                  ${display(value, context?.locale)}
                </td>`;
              })}
            </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

// Both representations use the same data contract; CSS exposes exactly one.
export function renderResponsive(data: Block, context: RenderContext) {
  return html`<div class="semloom-comparison-responsive">
    <div class="semloom-comparison-wide">${renderTable(data, context)}</div>
    <div class="semloom-comparison-narrow">${renderCards(data, context)}</div>
  </div>`;
}

export function display(value: unknown, locale?: string): string {
  return value === undefined || value === null
    ? reportMessages(locale).notProvided
    : String(value);
}
export function valueFor(
  attributes: ComparisonBlock['items'][number]['attributes'],
  key: string,
): unknown {
  return Object.hasOwn(attributes, key) ? attributes[key] : undefined;
}
