import { expect, type Locator, type Page } from '@playwright/test';
import type {
  compile,
  InlineRun,
  ListContent,
  HierarchyNode,
  RichTextBlock,
  ListBlock,
  CodeBlock,
  ComparisonBlock,
  HierarchyBlock,
  ProseBlock,
} from '../../dist/index.js';

type InlineSnapshot = {
  text: string | null;
  marks: string[];
  href: string | null;
}[];
interface ListSnapshot {
  tag: string;
  items: { content: InlineSnapshot | null; children: ListSnapshot[] }[];
}
const inline = (runs: readonly InlineRun[]): InlineSnapshot =>
  runs.map((run) => ({
    text: run.text,
    marks: [...(run.marks ?? [])].sort(),
    href: run.href ?? null,
  }));
const list = (group: ListContent): ListSnapshot => ({
  tag: group.ordered ? 'OL' : 'UL',
  items: group.items.map((item) => ({
    content: inline(item.content),
    children: item.children ? [list(item.children)] : [],
  })),
});
// Keep each original count/attachment wait and its own timeout budget. Only
// data reads are batched; nested lists do not share one polling deadline.
async function waitList(region: Locator, group: ListContent) {
  await region.waitFor({ state: 'attached' });
  const items = region.locator(':scope > li');
  await expect(items).toHaveCount(group.items.length);
  for (const [index, item] of group.items.entries()) {
    const node = items.nth(index);
    await node
      .locator(':scope > .semloom-richtext')
      .waitFor({ state: 'attached' });
    if (item.children)
      await waitList(node.locator(':scope > .semloom-list'), item.children);
    else await expect(node.locator(':scope > .semloom-list')).toHaveCount(0);
  }
}
const tree = (node: HierarchyNode): object => ({
  label: node.label,
  children: (node.children ?? []).map(tree),
});

function readSnapshot(
  page: Page,
  blocks: { id: string; kind: string }[],
  enhanced: boolean,
  print: boolean,
) {
  return page.evaluate(
    ({ blocks, enhanced, print }) => {
      // Preserve single-element Locator strictness when reading whole blocks.
      function one(parent: ParentNode | null, selector: string) {
        const nodes = parent?.querySelectorAll(selector);
        return nodes?.length === 1 ? nodes[0]! : null;
      }
      function texts(parent: ParentNode | null, selector: string) {
        return [...(parent?.querySelectorAll(selector) ?? [])].map(
          (node) => node.textContent,
        );
      }
      function inline(element: Element | null): InlineSnapshot | null {
        if (!element) return null;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const runs: InlineSnapshot = [];
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          const parents: Element[] = [];
          for (
            let parent = text.parentElement;
            parent && parent !== element;
            parent = parent.parentElement
          )
            parents.push(parent);
          runs.push({
            text: text.textContent,
            marks: parents
              .flatMap(
                (parent) =>
                  ({ STRONG: ['strong'], EM: ['emphasis'], CODE: ['code'] })[
                    parent.tagName as 'STRONG' | 'EM' | 'CODE'
                  ] ?? [],
              )
              .sort(),
            href:
              parents
                .find((parent) => parent.tagName === 'A')
                ?.getAttribute('href') ?? null,
          });
        }
        return runs;
      }
      function list(element: Element | null): ListSnapshot | null {
        return (
          element && {
            tag: element.tagName,
            items: [...element.querySelectorAll(':scope > li')].map((item) => ({
              content: inline(one(item, ':scope > .semloom-richtext')),
              children: [
                ...item.querySelectorAll(':scope > .semloom-list'),
              ].map((child) => list(child)!),
            })),
          }
        );
      }
      function hierarchy(region: Element | null): object | null {
        const wrapper = one(region, ':scope > .semloom-hierarchy');
        if (
          region?.getAttribute('data-variant') === 'hierarchy.mindmap' &&
          enhanced &&
          !print
        ) {
          const svg = one(wrapper, 'svg.markmap');
          if (!svg) return null;
          const nodes = [...svg.querySelectorAll('g.markmap-node')].map(
            (node) => ({
              path: node.getAttribute('data-path')!,
              label: node.querySelector('foreignObject')!.textContent,
            }),
          );
          function read(path: string): object {
            return {
              label: nodes.find((node) => node.path === path)!.label,
              children: nodes
                .filter(
                  (node) =>
                    node.path.slice(0, node.path.lastIndexOf('.')) === path,
                )
                .sort(
                  (a, b) =>
                    Number(a.path.split('.').at(-1)) -
                    Number(b.path.split('.').at(-1)),
                )
                .map((node) => read(node.path)),
            };
          }
          return read(nodes.find((node) => !node.path.includes('.'))!.path);
        }
        function read(node: Element): object {
          return {
            label: node.querySelector(':scope > .semloom-hierarchy-label')!
              .textContent,
            children: [...node.querySelectorAll(':scope > ul > li')].map(read),
          };
        }
        const root = one(wrapper, '.semloom-hierarchy-root > li');
        return root && read(root);
      }
      return {
        blocks: blocks.map(({ id, kind }) => {
          const region = one(document, `#${CSS.escape(id)}`);
          let content: unknown;
          switch (kind) {
            case 'richtext':
              content = inline(one(region, ':scope > .semloom-richtext'));
              break;
            case 'list':
              content = list(one(region, ':scope > .semloom-list'));
              break;
            case 'code':
              content = one(region, 'pre > code')?.textContent ?? null;
              break;
            case 'prose':
              content = one(region, ':scope > .prose')?.textContent ?? null;
              break;
            case 'comparison': {
              const cards =
                region?.getAttribute('data-variant') === 'comparison.cards';
              content = {
                names: texts(
                  region,
                  cards ? '.comparison-card > :is(h2,h3,h4,h5,h6)' : 'tbody th',
                ),
                values: texts(
                  region,
                  cards ? '.comparison-card dd' : 'tbody td',
                ),
                labels: texts(
                  region,
                  cards
                    ? '.comparison-card:first-child dt'
                    : 'thead th:not(:first-child)',
                ),
              };
              break;
            }
            case 'hierarchy':
              content = hierarchy(region);
              break;
            default:
              throw new Error(`Workflow assertion missing for ${kind}`);
          }
          return { content, citations: texts(region, ':scope > .citations a') };
        }),
        toc: [...document.querySelectorAll('[data-toc] [data-section]')].map(
          (link) => ({
            title: link.textContent,
            id: link.getAttribute('href')!.slice(1),
          }),
        ),
        sources: texts(document, '.sources > ol > li'),
        brokenLinks: [...document.querySelectorAll('a[href^="#"]')]
          .filter(
            (link) =>
              !document.getElementById(
                decodeURIComponent(link.getAttribute('href')!.slice(1)),
              ),
          )
          .map((link) => link.getAttribute('href')),
        fitsWidth: document.documentElement.scrollWidth <= innerWidth,
      };
    },
    { blocks, enhanced, print },
  );
}

export async function workflowFidelity(
  page: Page,
  report: ReturnType<typeof compile>['document'],
  enhanced: boolean,
  print = false,
) {
  await expect(page.locator('h1')).toHaveText(report.data.title);
  for (const block of report.blocks) {
    const region = page.locator(`#${block.id}`);
    if (block.data.kind === 'richtext')
      await region
        .locator(':scope > .semloom-richtext')
        .waitFor({ state: 'attached' });
    if (block.data.kind === 'list')
      await waitList(
        region.locator(':scope > .semloom-list'),
        block.data as ListBlock,
      );
    if (block.data.kind === 'prose')
      await region.locator(':scope > .prose').waitFor({ state: 'attached' });
    if (block.data.kind === 'comparison')
      await region.waitFor({ state: 'attached' });
    if (block.data.kind === 'code') {
      await region.locator('pre > code').waitFor({ state: 'attached' });
      await expect(region.locator('pre')).toHaveCSS(
        'white-space',
        print ? 'pre-wrap' : 'pre',
      );
    }
    if (block.data.kind !== 'hierarchy') continue;
    const wrapper = region.locator(':scope > .semloom-hierarchy');
    const mindmap =
      (await region.getAttribute('data-variant')) === 'hierarchy.mindmap';
    if (mindmap && enhanced && !print) {
      await expect(wrapper).toHaveAttribute('data-mindmap-ready', '');
      await wrapper.locator('svg.markmap').waitFor({ state: 'attached' });
      await expect
        .poll(() =>
          wrapper
            .locator('.markmap-foreign > div > div')
            .evaluateAll((labels) => {
              const boxes = labels.map((label) =>
                label.getBoundingClientRect(),
              );
              return labels.every(
                (label, i) =>
                  boxes[i]!.width > 0 &&
                  label.scrollWidth <= label.clientWidth + 1 &&
                  label.scrollHeight <= label.clientHeight + 1 &&
                  boxes.every(
                    (other, j) =>
                      i === j ||
                      Math.min(boxes[i]!.right, other.right) -
                        Math.max(boxes[i]!.left, other.left) <=
                        0.5 ||
                      Math.min(boxes[i]!.bottom, other.bottom) -
                        Math.max(boxes[i]!.top, other.top) <=
                        0.5,
                  ),
              );
            }),
        )
        .toBe(true);
    } else
      await expect(
        wrapper.locator('.semloom-hierarchy-root > li'),
      ).toBeVisible();
  }
  await expect(page.locator('[data-toc-source]')).toHaveAttribute(
    'href',
    '#semloom-sources',
  );
  const expected = report.blocks.map(({ data }) => {
    switch (data.kind) {
      case 'richtext':
        return inline((data as RichTextBlock).content);
      case 'list':
        return list(data as ListBlock);
      case 'code':
        return (data as CodeBlock).text;
      case 'prose':
        return (data as ProseBlock).text;
      case 'hierarchy':
        return tree((data as HierarchyBlock).root);
      case 'comparison': {
        const comparison = data as ComparisonBlock;
        return {
          names: comparison.items.map((item) => item.name),
          values: comparison.items.flatMap((item) =>
            comparison.fields.map((field) =>
              String(item.attributes[field.key]),
            ),
          ),
          labels: comparison.fields.map((field) => field.label),
        };
      }
      default:
        throw new Error(`Workflow assertion missing for ${data.kind}`);
    }
  });
  const blocks = report.blocks.map(({ id, data }) => ({ id, kind: data.kind }));
  const actual = await readSnapshot(page, blocks, enhanced, print);
  for (const [i, block] of report.blocks.entries()) {
    expect(actual.blocks[i]!.content).toEqual(expected[i]);
    expect(actual.blocks[i]!.citations).toEqual(
      (block.data.sourceIds ?? []).map(
        (id) => report.data.sources!.find((source) => source.id === id)!.title,
      ),
    );
  }
  const sections = report.sections.flatMap(
    function flatten(section): typeof report.sections {
      return [section, ...section.sections.flatMap(flatten)];
    },
  );
  expect(actual.toc).toEqual(
    sections.map((section) => ({ title: section.title, id: section.id })),
  );
  expect(actual.sources).toEqual(
    report.data.sources!.map((source) => source.title),
  );
  expect(actual.brokenLinks).toEqual([]);
  expect(actual.fitsWidth).toBe(true);
}
