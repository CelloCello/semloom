import type {
  InsightBlock,
  KindDefinition,
  MetricsBlock,
  StepsBlock,
  TimelineBlock,
  StyleAsset,
} from '../core/types.js';
import { heading, html } from '../html/html.js';

const label = { type: 'string', minLength: 1, maxLength: 1000 };
const text = { type: 'string', minLength: 1, maxLength: 20000 };
const styles: StyleAsset = {
  id: 'semloom.content',
  type: 'css',
  content: `.semloom-insight{padding:1.25rem 1.5rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius,12px)}.semloom-insight-label{font-size:.875rem;font-weight:600;color:var(--muted);margin:0 0 .5rem}.semloom-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:var(--space);margin:0}.semloom-metric{padding:1rem 0;border-top:1px solid var(--line);min-width:0}.semloom-metric dd{font-size:1.4rem;font-weight:600}.semloom-metric .semloom-comparison{display:block;font-size:.875rem;font-weight:400;color:var(--muted);white-space:pre-wrap}.semloom-steps,.semloom-timeline{padding-left:1.5rem;margin:0}.semloom-steps li,.semloom-timeline li{padding-left:.5rem;margin:0 0 1.5rem;min-width:0}.semloom-steps li::marker{color:var(--accent);font-weight:600}.semloom-steps h3,.semloom-steps h4,.semloom-timeline h3,.semloom-timeline h4{margin-bottom:.5rem}.semloom-stepper{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:2rem;padding-left:1.5rem}.semloom-timeline-time{display:block;color:var(--muted);font-size:.875rem;margin-bottom:.35rem;white-space:pre-wrap;overflow-wrap:anywhere}.semloom-timeline li{border-bottom:1px solid var(--line);padding-bottom:1.25rem}.semloom-insight p,.semloom-metrics dt,.semloom-steps h3,.semloom-steps h4,.semloom-steps h5,.semloom-timeline h3,.semloom-timeline h4,.semloom-timeline h5{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){.semloom-stepper{display:block}.semloom-insight{padding:1rem}}@media print{.semloom-metrics{display:block}.semloom-metric{break-inside:avoid}.semloom-stepper{display:block}.semloom-steps li,.semloom-timeline li{break-inside:avoid}}`,
};
const always = () => ({
  supported: true,
  reason: 'All supplied content remains visible in input order.',
});
const stepSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title'],
  properties: { title: label, description: text },
};
function stepperPreferred(block: StepsBlock) {
  return (
    block.items.length >= 2 &&
    block.items.length <= 5 &&
    block.items.every(
      (item) =>
        item.title.length <= 60 && (item.description?.length ?? 0) <= 140,
    )
  );
}
export const contentKinds: KindDefinition[] = [
  {
    kind: 'insight',
    dataVersion: '1.0',
    schema: {
      type: 'object',
      properties: {
        level: { enum: ['info', 'success', 'warning', 'error'] },
        text,
      },
      required: ['level', 'text'],
    },
    variants: [
      {
        id: 'insight.callout',
        supports: always,
        score: () => 0,
        assets: [styles],
        render: (data) => {
          const block = data as InsightBlock;
          const labels = {
            info: '資訊',
            success: '成果',
            warning: '注意',
            error: '問題',
          };
          return html`<aside
            class="semloom-insight"
            data-level="${block.level}"
          >
            <p class="semloom-insight-label">${labels[block.level]}</p>
            <p class="prose">${block.text}</p>
          </aside>`;
        },
      },
    ],
  },
  {
    kind: 'metrics',
    dataVersion: '1.0',
    schema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'value'],
            properties: {
              label,
              value: { type: 'number' },
              unit: label,
              comparisonValue: { type: 'number' },
              comparisonLabel: label,
            },
            dependencies: { comparisonLabel: ['comparisonValue'] },
          },
        },
      },
    },
    variants: [
      {
        id: 'metrics.summary',
        supports: always,
        score: () => 0,
        assets: [styles],
        render: (data) =>
          html`<dl class="semloom-metrics">
            ${(data as MetricsBlock).items.map(
              (item) =>
                html`<div class="semloom-metric">
                  <dt>${item.label}</dt>
                  <dd>
                    <span>${item.value}${item.unit ? ` ${item.unit}` : ''}</span
                    >${item.comparisonValue !== undefined ? html`<span class="semloom-comparison">${item.comparisonLabel ?? '比較值'}：${item.comparisonValue}${item.unit ? ` ${item.unit}` : ''}</span>` : ''}
                  </dd>
                </div>`,
            )}
          </dl>`,
      },
    ],
  },
  {
    kind: 'steps',
    dataVersion: '1.0',
    schema: {
      type: 'object',
      properties: {
        title: label,
        items: { type: 'array', minItems: 1, maxItems: 200, items: stepSchema },
      },
      required: ['items'],
    },
    variants: ['list', 'stepper'].map((view) => ({
      id: `steps.${view}`,
      supports: always,
      score: (data) =>
        stepperPreferred(data as StepsBlock) === (view === 'stepper')
          ? 100
          : 50,
      assets: [styles],
      render: (data, context) => {
        const block = data as StepsBlock;
        return html`<div>
          ${block.title ? heading(context.headingLevel, block.title) : ''}
          <ol
            class="semloom-steps${view === 'stepper' ? ' semloom-stepper' : ''}"
          >
            ${block.items.map((item) => html`<li>${heading(context.headingLevel + (block.title ? 1 : 0), item.title)}${item.description ? html`<p class="prose">${item.description}</p>` : ''}</li>`)}
          </ol>
        </div>`;
      },
    })),
  },
  {
    kind: 'timeline',
    dataVersion: '1.0',
    schema: {
      type: 'object',
      required: ['items'],
      properties: {
        title: label,
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 200,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['time', 'title'],
            properties: { time: label, title: label, description: text },
          },
        },
      },
    },
    variants: [
      {
        id: 'timeline.vertical',
        supports: always,
        score: () => 0,
        assets: [styles],
        render: (data, context) => {
          const block = data as TimelineBlock;
          return html`<div>
            ${block.title ? heading(context.headingLevel, block.title) : ''}
            <ol class="semloom-timeline">
              ${block.items.map((item) => html`<li><span class="semloom-timeline-time">${item.time}</span>${heading(context.headingLevel + (block.title ? 1 : 0), item.title)}${item.description ? html`<p class="prose">${item.description}</p>` : ''}</li>`)}
            </ol>
          </div>`;
        },
      },
    ],
  },
];
