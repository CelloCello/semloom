import { hierarchyNodeSchema } from '../core/hierarchy.js';
import type {
  HierarchyBlock,
  HierarchyNode,
  HtmlFragment,
  KindDefinition,
  StyleAsset,
} from '../core/types.js';
import { html } from '../html/html.js';
import { hierarchyCss } from '../html/styles/hierarchy.js';
import { reportMessages } from '../core/report-messages.js';

const styles: StyleAsset = {
  id: 'semloom.hierarchy',
  type: 'css',
  content: hierarchyCss,
};
function renderNode(node: HierarchyNode): HtmlFragment {
  return html`<li class="semloom-hierarchy-node">
    <div class="semloom-hierarchy-label">${node.label}</div>
    ${
      node.children?.length
        ? html`<ul class="semloom-hierarchy-children">
            ${node.children.map(renderNode)}
          </ul>`
        : ''
    }
  </li>`;
}
export const hierarchyKind: KindDefinition = {
  kind: 'hierarchy',
  dataVersion: '1.0',
  schema: {
    type: 'object',
    required: ['root'],
    properties: { root: hierarchyNodeSchema() },
  },
  variants: ['tree', 'mindmap'].map((view) => ({
    id: `hierarchy.${view}`,
    supports: () => ({
      supported: true,
      reason:
        'All hierarchy labels, child relationships and sibling order remain available.',
    }),
    score: () => (view === 'tree' ? 100 : 50),
    assets: [styles],
    render: (data, context) => {
      const content = html`<ul class="semloom-hierarchy-root">
        ${renderNode((data as HierarchyBlock).root)}
      </ul>`;
      return view === 'tree'
        ? html`<div class="semloom-hierarchy semloom-hierarchy-tree">
            ${content}
          </div>`
        : html`<div class="semloom-hierarchy semloom-hierarchy-mindmap">
            <div
              class="semloom-mindmap-diagram"
              role="region"
              aria-label="${reportMessages(context.locale).mindmapHelp}"
              lang="${reportMessages(context.locale).locale}"
              tabindex="0"
              hidden
            ></div>
            <div class="semloom-hierarchy-tree" data-mindmap-fallback>
              ${content}
            </div>
          </div>`;
    },
  })),
};
