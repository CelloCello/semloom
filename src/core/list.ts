import { inlineContentSchema, validateInlineContent } from './inline.js';
import { fail, type JsonSchema, type ListContent } from './types.js';

export const listLimits = { depth: 8, items: 1000 } as const;

// Bounded, inlined schemas also work when Registry compiles a kind on its own.
export function listContentSchema(depth = 1): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['ordered', 'items'],
    properties: {
      ordered: { type: 'boolean' },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: listLimits.items,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['content'],
          properties: {
            content: inlineContentSchema(),
            ...(depth < listLimits.depth
              ? { children: listContentSchema(depth + 1) }
              : {}),
          },
        },
      },
    },
  };
}

export function validateListContent(
  content: ListContent,
  path: string,
  anchors: ReadonlySet<string>,
): void {
  let count = 0;
  function visit(group: ListContent, location: string) {
    for (const [index, item] of group.items.entries()) {
      const itemPath = `${location}/items/${index}`;
      if (++count > listLimits.items)
        fail(
          itemPath,
          'LIST_LIMIT',
          `List exceeds ${listLimits.items} items in total.`,
        );
      validateInlineContent(item.content, `${itemPath}/content`, anchors);
      if (item.children) visit(item.children, `${itemPath}/children`);
    }
  }
  visit(content, path);
}
