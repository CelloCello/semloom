import { inlineContentSchema } from '../core/inline.js';
import type { KindDefinition, RichTextBlock } from '../core/types.js';
import { html } from '../html/html.js';
import { renderInline } from '../html/inline.js';

export const richTextKind: KindDefinition = {
  kind: 'richtext',
  dataVersion: '1.0',
  schema: {
    type: 'object',
    properties: { content: inlineContentSchema() },
    required: ['content'],
  },
  variants: [
    {
      id: 'richtext.paragraph',
      supports: () => ({
        supported: true,
        reason: 'All inline text, marks and links remain visible in order.',
      }),
      score: () => 0,
      render: (data) =>
        html`<p class="prose semloom-richtext">
          ${renderInline((data as RichTextBlock).content)}
        </p>`,
    },
  ],
};
