import { codeLimits } from '../core/code.js';
import type { CodeBlock, KindDefinition } from '../core/types.js';
import { escape, fragment, html } from '../html/html.js';
import { reportMessages } from '../core/report-messages.js';

export const codeKind: KindDefinition = {
  kind: 'code',
  dataVersion: '1.0',
  schema: {
    type: 'object',
    required: ['text'],
    properties: {
      // NUL and unpaired surrogates cannot round-trip through a UTF-8 HTML file.
      text: {
        type: 'string',
        minLength: 1,
        maxLength: codeLimits.text,
        pattern: '^[^\\u0000\\uD800-\\uDFFF]*$',
      },
      language: {
        type: 'string',
        minLength: 1,
        maxLength: codeLimits.language,
      },
    },
  },
  variants: [
    {
      id: 'code.block',
      supports: () => ({
        supported: true,
        reason: 'Code is displayed literally with its original whitespace.',
      }),
      score: () => 0,
      render: (data, context) => {
        const block = data as CodeBlock;
        const messages = reportMessages(context.locale);
        // Encode CR after escaping: HTML parsing would otherwise normalize CRLF/CR.
        const text = fragment(escape(block.text).replace(/\r/g, '&#13;'));
        return html`<figure class="semloom-code">
          ${block.language ? html`<figcaption>${block.language}</figcaption>` : ''}
          <pre
            tabindex="0"
            role="region"
            lang="${messages.locale}"
            aria-label="${block.language ? `${messages.code}${messages.separator}${block.language}` : messages.code}"
          ><code lang="${context.locale}">${text}</code></pre>
        </figure>`;
      },
    },
  ],
};
