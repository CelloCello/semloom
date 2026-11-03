import { diagramSchema, validateDiagram } from '../core/diagram.js';
import { fail, type KindDefinition, type DiagramBlock } from '../core/types.js';
import { diagramEngine } from '../node/pele.js';
import { svgFragment, svgIdentity } from '../node/svg.js';
import { html, fragment, escape } from '../html/html.js';
import { visualCaption } from '../html/visuals.js';
import { visualsCss } from '../html/styles/visuals.js';
import { reportMessages } from '../core/report-messages.js';

export const diagramKind: KindDefinition = {
  kind: 'diagram',
  dataVersion: '1.0',
  schema: diagramSchema,
  variants: [
    {
      id: 'diagram.svg',
      supports: () => ({
        supported: true,
        reason:
          'Validated Mermaid source rendered as a static diagram with exact source and author description.',
      }),
      score: () => 0,
      render: (data, context) => {
        const block = data as DiagramBlock;
        if (!context.blockId)
          fail(
            '/',
            'RENDER_ID_REQUIRED',
            'Core must provide the resolved blockId.',
          );
        validateDiagram(block, '');
        const messages = reportMessages(context.locale);
        const options = {
          fontSize: 16,
          fontFamily: 'sans-serif',
          padding: 18,
          links: false,
          images: false,
          responsive: false,
          outputLimit: 2_000_000,
          maxEdges: 200,
          limit: 10000,
        };
        try {
          const wide = diagramEngine().render(block.source, {
            ...options,
            idPrefix: svgIdentity(context.blockId, 'wide'),
          });
          const narrow = diagramEngine().render(block.source, {
            ...options,
            idPrefix: svgIdentity(context.blockId, 'narrow'),
            maxWidth: 320,
            autoDirection: !block.preserveDirection,
            directionBreakpoint: 760,
          });
          const print = diagramEngine().render(block.source, {
            ...options,
            idPrefix: svgIdentity(context.blockId, 'print'),
            maxWidth: 680,
            autoDirection: !block.preserveDirection,
            directionBreakpoint: 760,
          });
          const fontSizes = [
            ...print.svg.matchAll(/font-size="([\d.]+)"/gu),
          ].map((m) => Number(m[1]));
          const printScale = Math.min(1, 640 / print.width);
          if (
            !Number.isFinite(print.width + print.height) ||
            Math.min(16, ...fontSizes) * printScale < 32 / 3 ||
            print.height * printScale > 700
          )
            fail(
              '/source',
              'DIAGRAM_LAYOUT_LIMIT',
              'Split this diagram: it exceeds the readable A4 print budget.',
            );
          const source = fragment(escape(block.source).replace(/\r/g, '&#13;'));
          return html`<figure class="semloom-visual semloom-diagram">
            ${visualCaption(block, context)}
            <div
              class="semloom-plot semloom-visual-wide"
              role="region"
              tabindex="0"
              aria-label="${block.title}"
            >
              ${svgFragment(wide.svg, svgIdentity(context.blockId, 'wide'))}
            </div>
            <div
              class="semloom-plot semloom-visual-narrow"
              role="region"
              tabindex="0"
              aria-label="${block.title}"
            >
              ${svgFragment(narrow.svg, svgIdentity(context.blockId, 'narrow'))}
            </div>
            <div class="semloom-print-panels">
              <div class="semloom-print-panel">
                ${svgFragment(print.svg, svgIdentity(context.blockId, 'print'))}
              </div>
            </div>
            <details class="semloom-diagram-source">
              <summary lang="${messages.locale}">
                ${messages.diagramSource}
              </summary>
              <pre tabindex="0"><code>${source}</code></pre>
            </details>
            <pre class="semloom-print-table"><code>${source}</code></pre>
          </figure>`;
        } catch (error) {
          if (error instanceof Error && error.name === 'SemloomError')
            throw error;
          fail(
            '/source',
            'DIAGRAM_LAYOUT_LIMIT',
            'Split this diagram: its layout or SVG exceeds the supported readable limits.',
          );
        }
      },
      assets: [{ id: 'semloom.visuals', type: 'css', content: visualsCss }],
    },
  ],
};
