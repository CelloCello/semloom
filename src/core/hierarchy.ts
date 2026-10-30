import { fail, type HierarchyNode, type JsonSchema } from './types.js';

export const hierarchyLimits = { depth: 8, nodes: 1000, label: 1000 } as const;

// Finite, self-contained expansion works in both kind and document schemas.
export function hierarchyNodeSchema(depth = 1): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['label'],
    properties: {
      label: { type: 'string', minLength: 1, maxLength: hierarchyLimits.label },
      children:
        depth < hierarchyLimits.depth
          ? {
              type: 'array',
              maxItems: hierarchyLimits.nodes,
              items: hierarchyNodeSchema(depth + 1),
            }
          : { type: 'array', maxItems: 0 },
    },
  };
}

export function validateHierarchy(root: HierarchyNode, path: string): void {
  let count = 0;
  function visit(node: HierarchyNode, location: string) {
    if (++count > hierarchyLimits.nodes)
      fail(
        location,
        'HIERARCHY_LIMIT',
        `Hierarchy exceeds ${hierarchyLimits.nodes} nodes in total.`,
      );
    for (const [index, child] of (node.children ?? []).entries())
      visit(child, `${location}/children/${index}`);
  }
  visit(root, path);
}
