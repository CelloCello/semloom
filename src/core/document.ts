import type { Registry } from './registry.js';
import { checkSchema, documentSchema, limits, safeUrl } from './schema.js';
import {
  fail,
  SemloomError,
  type Block,
  type ComparisonBlock,
  type Document,
  type Section,
} from './types.js';

export interface ResolvedBlock {
  id: string;
  explicit: boolean;
  path: string;
  data: Block;
}
export interface ResolvedSection {
  id: string;
  title: string;
  blocks: ResolvedBlock[];
  sections: ResolvedSection[];
}
export interface ResolvedDocument {
  data: Document;
  sections: ResolvedSection[];
  blocks: ResolvedBlock[];
}
export function sourceAnchor(id: string): string {
  return `semloom-source-${id}`;
}

export function resolveDocument(
  input: unknown,
  registry: Registry,
): ResolvedDocument {
  checkSchema<Document>(documentSchema(registry), input);
  const data = structuredClone(input);
  const used = new Set<string>();
  let sectionCount = 0;
  let blockCount = 0;
  const sources = new Set<string>();
  for (const [i, source] of (data.sources ?? []).entries()) {
    if (sources.has(source.id))
      fail(
        `/sources/${i}/id`,
        'DUPLICATE_SOURCE',
        'Source IDs must be unique.',
      );
    sources.add(source.id);
    if (source.url !== undefined) {
      try {
        safeUrl(source.url);
      } catch (error) {
        if (error instanceof SemloomError)
          throw new SemloomError(
            error.diagnostics.map((d) => ({ ...d, path: `/sources/${i}/url` })),
          );
        throw error;
      }
    }
  }
  const reserve = (node: Section | Block, path: string) => {
    if (node.id !== undefined) {
      if (used.has(node.id))
        fail(
          `${path}/id`,
          'DUPLICATE_ID',
          'Section and Block IDs must be unique.',
        );
      used.add(node.id);
    }
  };
  function scan(sections: Section[], path: string) {
    for (const [i, section] of sections.entries()) {
      const location = `${path}/${i}`;
      if (++sectionCount > limits.sections)
        fail(location, 'DOCUMENT_LIMIT', 'Too many sections in the document.');
      reserve(section, location);
      for (const [j, block] of (section.blocks ?? []).entries()) {
        if (++blockCount > limits.blocks)
          fail(
            `${location}/blocks/${j}`,
            'DOCUMENT_LIMIT',
            'Too many blocks in the document.',
          );
        reserve(block, `${location}/blocks/${j}`);
      }
      scan(section.sections ?? [], `${location}/sections`);
    }
  }
  scan(data.sections, '/sections');
  function allocate(text: string): string {
    const base =
      text
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'node';
    const safeBase = base.startsWith('semloom-') ? `node-${base}` : base;
    let candidate = safeBase;
    for (let suffix = 2; used.has(candidate); suffix++)
      candidate = `${safeBase}-${suffix}`;
    used.add(candidate);
    return candidate;
  }
  const blocks: ResolvedBlock[] = [];
  function resolve(sections: Section[], path: string): ResolvedSection[] {
    return sections.map((section, i) => {
      const location = `${path}/${i}`;
      const id = section.id ?? allocate(section.title);
      const sectionBlocks = (section.blocks ?? []).map((block, j) => {
        const blockPath = `${location}/blocks/${j}`;
        for (const [r, sourceId] of (block.sourceIds ?? []).entries()) {
          if (!sources.has(sourceId))
            fail(
              `${blockPath}/sourceIds/${r}`,
              'DANGLING_SOURCE',
              `Unknown source ${JSON.stringify(sourceId).slice(0, 100)}.`,
            );
        }
        if (block.kind === 'comparison')
          validateComparison(block as ComparisonBlock, blockPath);
        const resolved = {
          id: block.id ?? allocate(block.kind),
          explicit: block.id !== undefined,
          path: blockPath,
          data: block,
        };
        blocks.push(resolved);
        return resolved;
      });
      return {
        id,
        title: section.title,
        blocks: sectionBlocks,
        sections: resolve(section.sections ?? [], `${location}/sections`),
      };
    });
  }
  const sections = resolve(data.sections, '/sections');
  const anchors = new Set([
    ...used,
    ...(data.sources ?? []).map((s) => sourceAnchor(s.id)),
  ]);
  for (const [i, source] of (data.sources ?? []).entries()) {
    if (source.url?.startsWith('#')) {
      let target: string;
      try {
        target = decodeURIComponent(source.url.slice(1));
      } catch {
        fail(
          `/sources/${i}/url`,
          'INVALID_ANCHOR',
          'Invalid percent encoding.',
        );
      }
      if (!anchors.has(target))
        fail(
          `/sources/${i}/url`,
          'INVALID_ANCHOR',
          'Anchor does not exist in this document.',
        );
    }
  }
  return { data, sections, blocks };
}
function validateComparison(block: ComparisonBlock, path: string) {
  const keys = new Set<string>();
  for (const [i, field] of block.fields.entries()) {
    if (keys.has(field.key))
      fail(
        `${path}/fields/${i}/key`,
        'DUPLICATE_FIELD',
        'Comparison field keys must be unique.',
      );
    keys.add(field.key);
  }
  for (const [i, item] of block.items.entries()) {
    for (const key of Object.keys(item.attributes)) {
      if (!keys.has(key))
        fail(
          `${path}/items/${i}/attributes/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
          'UNKNOWN_FIELD',
          `Undeclared comparison field ${JSON.stringify(key).slice(0, 100)}.`,
        );
    }
  }
}
