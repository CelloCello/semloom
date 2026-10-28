import { html, heading } from 'semloom/browser';

export function renderRows(block, context) {
  return html`<div class="example-comparison">
    ${heading(context.headingLevel, block.subject)}
    <dl>
      ${block.items.map(
        (item) =>
          html`<div>
            <dt>${item.name}</dt>
            <dd>
              ${block.fields.map((field) => {
                const value = Object.hasOwn(item.attributes, field.key)
                  ? item.attributes[field.key]
                  : undefined;
                return html`<p>
                  ${field.label}${field.unit ? ` (${field.unit})` : ''}：${value === null || value === undefined ? '未提供' : String(value)}
                </p>`;
              })}
            </dd>
          </div>`,
      )}
    </dl>
  </div>`;
}
