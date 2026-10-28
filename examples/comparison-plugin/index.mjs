import { renderRows } from './templates.mjs';
import { html, heading } from 'semloom';

const base = {
  id: 'example.base',
  type: 'css',
  content:
    '.example-note,.example-comparison{padding:var(--space);border:1px solid var(--line);border-radius:var(--radius,12px);background:var(--surface)}',
};
const noteStyle = {
  id: 'example.note',
  type: 'css',
  dependsOn: ['example.base'],
  content:
    '.example-note p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}',
};
const rowsStyle = {
  id: 'example.rows',
  type: 'css',
  dependsOn: ['example.base'],
  content:
    '.example-comparison dl{margin:0}.example-comparison dl>div+div{border-top:1px solid var(--line);margin-top:var(--space);padding-top:var(--space)}.example-comparison dt{font-weight:600;color:var(--ink)}.example-comparison dd{margin:0}.example-comparison p{margin:.5rem 0;white-space:pre-wrap;overflow-wrap:anywhere}',
};

export default {
  id: 'example.presentation',
  version: '1.0.0',
  pluginApiVersion: '1.0',
  requires: { 'semloom.builtin': '0.1.0-dev.1' },
  kinds: [
    {
      kind: 'example.note',
      dataVersion: '1.0',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 1000 },
          text: { type: 'string', minLength: 1, maxLength: 20000 },
        },
        required: ['text'],
      },
      variants: [
        {
          id: 'example.note.panel',
          supports: () => ({
            supported: true,
            reason: 'All note text is visible.',
          }),
          score: () => 0,
          assets: [base, noteStyle],
          render: (block, context) =>
            html`<aside class="example-note">
              ${heading(context.headingLevel, block.title ?? '補充說明')}
              <p>${block.text}</p>
            </aside>`,
        },
      ],
    },
  ],
  extensions: [
    {
      targetKind: 'comparison',
      targetDataVersion: '1.0',
      variants: [
        {
          id: 'example.comparison.rows',
          supports: () => ({
            supported: true,
            reason: 'Every item, field and value is shown in input order.',
          }),
          score: () => 25,
          assets: [base, rowsStyle],
          render: renderRows,
          browser: {
            entry: './browser.mjs',
            exportName: 'createView',
            label: '逐項清單',
          },
        },
      ],
    },
  ],
};
