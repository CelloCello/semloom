import { fileURLToPath } from 'node:url';
import {
  renderCards,
  renderTable,
  renderResponsive,
  display,
  valueFor,
} from './comparison.js';
import { Registry } from '../core/registry.js';
import type { ComparisonBlock, Plugin, ProseBlock } from '../core/types.js';
import { html } from '../html/html.js';
import { contentKinds } from './content.js';
import { richTextKind } from './richtext.js';
import { listKind } from './list.js';
import { codeKind } from './code.js';
import { hierarchyKind } from './hierarchy.js';

const short = { type: 'string', maxLength: 1000 };
const cell = {
  anyOf: [
    { type: 'string', maxLength: 20000 },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' },
  ],
};
const builtin: Plugin = {
  id: 'semloom.builtin',
  version: '0.1.0-dev.1',
  pluginApiVersion: '1.0',
  kinds: [
    {
      kind: 'prose',
      dataVersion: '1.0',
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 100000 },
        },
        required: ['text'],
      },
      variants: [
        {
          id: 'prose.paragraph',
          supports: () => ({
            supported: true,
            reason: 'Plain text is always representable.',
          }),
          score: () => 0,
          render: (data) =>
            html`<p class="prose">${(data as ProseBlock).text}</p>`,
        },
      ],
    },
    {
      kind: 'comparison',
      dataVersion: '1.0',
      schema: {
        type: 'object',
        properties: {
          subject: { ...short, minLength: 1 },
          fields: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'label'],
              properties: {
                key: { type: 'string', minLength: 1, maxLength: 100 },
                label: { ...short, minLength: 1 },
                unit: short,
              },
            },
          },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 1000,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'attributes'],
              properties: {
                name: { ...short, minLength: 1 },
                attributes: {
                  type: 'object',
                  maxProperties: 50,
                  additionalProperties: cell,
                },
              },
            },
          },
        },
        required: ['subject', 'fields', 'items'],
      },
      variants: [
        {
          id: 'comparison.responsive',
          supports: () => ({
            supported: true,
            reason:
              'Ordered fields remain available as a table or cards at every width.',
          }),
          // Explicit opt-in preserves the existing Auto cards/table decisions.
          score: () => 0,
          render: renderResponsive,
          assets: [
            {
              id: 'semloom.comparison-responsive',
              type: 'css',
              content: `.semloom-comparison-responsive > .semloom-comparison-narrow{display:none}@media screen and (max-width:760px){.semloom-comparison-responsive > .semloom-comparison-wide{display:none}.semloom-comparison-responsive > .semloom-comparison-narrow{display:block}.semloom-comparison-responsive .cards{grid-template-columns:minmax(0,1fr)}}@media print{.semloom-comparison-responsive > .semloom-comparison-wide{display:block}.semloom-comparison-responsive > .semloom-comparison-narrow{display:none}}`,
            },
          ],
          browser: {
            entry: fileURLToPath(
              new URL('../browser/adapters/responsive.js', import.meta.url),
            ),
            exportName: 'createView',
            label: '自適應',
          },
        },
        {
          id: 'comparison.cards',
          supports: () => ({
            supported: true,
            reason: 'All values remain visible in cards.',
          }),
          score: (data) => (compact(data as ComparisonBlock) ? 100 : 10),
          render: renderCards,
          browser: {
            entry: fileURLToPath(
              new URL('../browser/adapters/cards.js', import.meta.url),
            ),
            exportName: 'createView',
            label: '卡片',
          },
        },
        {
          id: 'comparison.table',
          supports: () => ({
            supported: true,
            reason: 'All fields fit a horizontally scrollable table.',
          }),
          score: (data) => (compact(data as ComparisonBlock) ? 50 : 100),
          render: renderTable,
          browser: {
            entry: fileURLToPath(
              new URL('../browser/adapters/table.js', import.meta.url),
            ),
            exportName: 'createView',
            label: '表格',
          },
        },
      ],
    },
    ...contentKinds,
    richTextKind,
    listKind,
    codeKind,
    hierarchyKind,
  ],
};
function compact(block: ComparisonBlock): boolean {
  return (
    block.items.length <= 3 &&
    block.fields.length <= 3 &&
    block.items.every((item) =>
      block.fields.every(
        (field) => display(valueFor(item.attributes, field.key)).length <= 90,
      ),
    )
  );
}
export function createRegistry(plugins: readonly Plugin[] = []): Registry {
  const registry = new Registry();
  registry.register(builtin);
  for (const plugin of plugins) registry.register(plugin);
  registry.freeze();
  return registry;
}
