import type { Block, ComparisonBlock, RenderContext } from '../core/types.js';
import { heading, html } from '../html/html.js';

export function renderCards(data: Block, context: RenderContext) {
  const block = data as ComparisonBlock;
  return html`<div class="comparison">
    ${heading(context.headingLevel, block.subject)}
    <div class="cards">
      ${block.items.map(
        (item) =>
          html`<article class="comparison-card">
            ${heading(context.headingLevel + 1, item.name)}
            <dl>
              ${block.fields.map(
                (field) =>
                  html`<div class="attribute">
                    <dt>
                      ${field.label}${field.unit ? ` (${field.unit})` : ''}
                    </dt>
                    <dd>${display(valueFor(item.attributes, field.key))}</dd>
                  </div>`,
              )}
            </dl>
          </article>`,
      )}
    </div>
  </div>`;
}

export function renderTable(data: Block) {
  const block = data as ComparisonBlock;
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
          <th scope="col">對象</th>
          ${block.fields.map((field) => html`<th scope="col">${field.label}${field.unit ? ` (${field.unit})` : ''}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${block.items.map(
          (item) =>
            html`<tr>
              <th scope="row">${item.name}</th>
              ${block.fields.map((field) => html`<td>${display(valueFor(item.attributes, field.key))}</td>`)}
            </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

export function display(value: unknown): string {
  return value === undefined || value === null ? '未提供' : String(value);
}
export function valueFor(
  attributes: ComparisonBlock['items'][number]['attributes'],
  key: string,
): unknown {
  return Object.hasOwn(attributes, key) ? attributes[key] : undefined;
}
