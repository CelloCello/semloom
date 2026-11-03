import { chartSchema } from '../core/chart.js';
import {
  fail,
  type ChartBlock,
  type KindDefinition,
  type RenderContext,
} from '../core/types.js';
import {
  chartGeometry,
  chartDomain,
  textWidth,
  wrapChartText,
} from '../core/chart-presentation.js';
import { reportMessages } from '../core/report-messages.js';
import { html } from '../html/html.js';
import { visualCaption, chartLegend, chartTable } from '../html/visuals.js';
import { visualsCss } from '../html/styles/visuals.js';
import { renderChart } from '../node/chart.js';
import { svgIdentity } from '../node/svg.js';

function render(block: ChartBlock, context: RenderContext) {
  if (!context.blockId)
    fail('/', 'RENDER_ID_REQUIRED', 'Core must provide the resolved blockId.');
  const id = context.blockId;
  const messages = reportMessages(context.locale);
  const wide = chartGeometry(block, 'wide'),
    narrow = chartGeometry(block, 'narrow');
  const print = chartGeometry(block, 'print');
  let rowWidth = 0,
    rowHeight = 22,
    legendHeight = 0;
  for (const item of block.chartType === 'donut'
    ? block.categories
    : block.series) {
    const width = Math.min(640, textWidth(item.label, 12) + 28);
    if (rowWidth && rowWidth + width + 20 > 640) {
      legendHeight += rowHeight;
      rowHeight = 22;
      rowWidth = 0;
    }
    rowWidth += width + 20;
    rowHeight = Math.max(
      rowHeight,
      wrapChartText(item.label, 612, 12).split('\n').length * 22,
    );
  }
  legendHeight += rowHeight + 32;
  const captionHeight =
    wrapChartText(
      `${block.title} · ${messages.chartRange} 100–100 (${block.unit ?? ''})`,
      640,
    ).split('\n').length *
      25 +
    16;
  const plotBudget = Math.min(650, 850 - legendHeight - captionHeight);
  const horizontal = block.orientation === 'horizontal';
  const count =
    block.chartType !== 'bar'
      ? block.categories.length
      : horizontal
        ? Math.floor((plotBudget - 100) / print.rowHeight)
        : Math.floor(
            (680 - 100) / Math.max(134, block.series.length * 14 + 30),
          );
  const invalid = () =>
    fail(
      '/categories',
      'CHART_LAYOUT_LIMIT',
      'Split this chart into smaller blocks: full labels and marks cannot fit the readable A4 print budget.',
    );
  if (
    count < 1 ||
    ((!horizontal || block.chartType === 'donut') &&
      print.height > plotBudget) ||
    !chartDomain(block).every(Number.isFinite)
  )
    invalid();
  const panels = [];
  for (let start = 0; start < block.categories.length; start += count) {
    const end = Math.min(block.categories.length, start + count);
    const geometry = {
      ...chartGeometry(block, 'print', end - start),
      width: 680,
    };
    panels.push(
      html`<div
        class="semloom-print-panel"
        data-start="${start}"
        data-end="${end}"
        data-domain="${JSON.stringify(chartDomain(block))}"
      >
        <p>
          ${block.title} · ${messages.chartRange}
          ${start + 1}–${end}${block.unit ? ` (${block.unit})` : ''}
        </p>
        ${chartLegend(block)}${renderChart(block, geometry, svgIdentity(id, `print-${start}`), [start, end])}
      </div>`,
    );
  }
  return html`<figure class="semloom-visual semloom-chart" data-chart-host>
    ${visualCaption(block, context)}
    <div class="semloom-chart-screen">
      <div
        class="semloom-plot semloom-visual-wide"
        role="region"
        tabindex="0"
        aria-label="${block.title}"
      >
        ${renderChart(block, wide, svgIdentity(id, 'wide'))}
      </div>
      <div
        class="semloom-plot semloom-visual-narrow"
        role="region"
        tabindex="0"
        aria-label="${block.title}"
      >
        ${renderChart(block, narrow, svgIdentity(id, 'narrow'))}
      </div>
    </div>
    ${chartLegend(block)}
    <div class="semloom-print-panels">${panels}</div>
    <details class="semloom-chart-table-disclosure">
      <summary lang="${messages.locale}">${messages.chartData}</summary>
      ${chartTable(block, context.locale)}
    </details>
    <div class="semloom-print-table">${chartTable(block, context.locale)}</div>
  </figure>`;
}

export const chartKind: KindDefinition = {
  kind: 'chart',
  dataVersion: '1.0',
  schema: chartSchema,
  variants: ['svg', 'static'].map((mode) => ({
    id: `chart.${mode}`,
    supports: () => ({
      supported: true,
      reason:
        'Controlled chart data with a complete static SVG and data table.',
    }),
    score: () => (mode === 'svg' ? 100 : 0),
    render: (data, context) => render(data as ChartBlock, context),
    assets: [{ id: 'semloom.visuals', type: 'css', content: visualsCss }],
  })),
};
