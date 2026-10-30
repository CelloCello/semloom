import type { HierarchyNode } from '../core/types.js';
import { escape } from '../html/html.js';

export interface MindmapNode {
  content: string;
  children: MindmapNode[];
}
// Markmap treats content as HTML. Build fresh nodes so runtime folding/state
// cannot mutate the author's semantic tree or turn labels into markup.
export function toMindmapNode(node: HierarchyNode): MindmapNode {
  return {
    content: escape(node.label),
    children: (node.children ?? []).map(toMindmapNode),
  };
}
