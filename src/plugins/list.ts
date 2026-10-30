import { listContentSchema } from '../core/list.js';
import type {
  HtmlFragment,
  KindDefinition,
  ListBlock,
  ListContent,
} from '../core/types.js';
import { html } from '../html/html.js';
import { renderInline } from '../html/inline.js';

function renderList(group: ListContent): HtmlFragment {
  const items = group.items.map(
    (item) =>
      html`<li>
        <div class="prose semloom-richtext">${renderInline(item.content)}</div>
        ${item.children ? renderList(item.children) : ''}
      </li>`,
  );
  return group.ordered
    ? html`<ol class="semloom-list">
        ${items}
      </ol>`
    : html`<ul class="semloom-list">
        ${items}
      </ul>`;
}

export const listKind: KindDefinition = {
  kind: 'list',
  dataVersion: '1.0',
  schema: listContentSchema(),
  variants: [
    {
      id: 'list.nested',
      supports: () => ({
        supported: true,
        reason: 'All items retain their order, nesting and inline content.',
      }),
      score: () => 0,
      render: (data) => renderList(data as ListBlock),
    },
  ],
};
