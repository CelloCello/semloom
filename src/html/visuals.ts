import { heading, html } from './html.js';
import { reportMessages } from '../core/report-messages.js';
import type { ChartBlock, DiagramBlock, RenderContext } from '../core/types.js';

export function visualCaption(
  block: ChartBlock | DiagramBlock,
  context: RenderContext,
) {
  return html`<figcaption>
    ${heading(context.headingLevel, block.title)}${block.description ? html`<p>${block.description}</p>` : ''}${block.kind === 'chart' && block.unit ? html`<p>${reportMessages(context.locale).chartUnit}${block.unit}</p>` : ''}
  </figcaption>`;
}
export function chartLegend(block: ChartBlock) {
  const items = block.chartType === 'donut' ? block.categories : block.series;
  return html`<ul class="semloom-visual-legend">
    ${items.map((item, i) => html`<li><span class="semloom-swatch" data-color="${i + 1}" aria-hidden="true"></span><span>${item.label}</span></li>`)}
  </ul>`;
}
export function chartTable(block: ChartBlock, locale: string) {
  const messages = reportMessages(locale);
  return html`<div
    class="table-scroll"
    role="region"
    tabindex="0"
    lang="${messages.locale}"
    aria-label="${messages.chartData}${messages.separator}${block.title}"
  >
    <table class="semloom-chart-table">
      <caption>
        ${block.title}${block.unit ? ` (${block.unit})` : ''}
      </caption>
      <thead>
        <tr>
          <th scope="col">${messages.item}</th>
          ${block.series.map((s) => html`<th scope="col">${s.label}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${block.categories.map(
          (c, i) =>
            html`<tr>
              <th scope="row">${c.label}</th>
              ${block.series.map((s) => html`<td>${s.values[i] === null ? messages.notProvided : String(s.values[i])}</td>`)}
            </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}
