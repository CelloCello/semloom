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

async function inline(region: Locator, expected: readonly InlineRun[]) {
  const actual = await region.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const runs = [];
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
  });
  expect(actual).toEqual(
    expected.map((run) => ({
      text: run.text,
      marks: [...(run.marks ?? [])].sort(),
      href: run.href ?? null,
    })),
  );
}
async function list(region: Locator, group: ListContent) {
  expect(await region.evaluate((element) => element.tagName)).toBe(
    group.ordered ? 'OL' : 'UL',
  );
  const items = region.locator(':scope > li');
  await expect(items).toHaveCount(group.items.length);
  for (const [index, item] of group.items.entries()) {
    const node = items.nth(index);
    await inline(node.locator(':scope > .semloom-richtext'), item.content);
    if (item.children)
      await list(node.locator(':scope > .semloom-list'), item.children);
    else await expect(node.locator(':scope > .semloom-list')).toHaveCount(0);
  }
}
const tree = (node: HierarchyNode): object => ({
  label: node.label,
  children: (node.children ?? []).map(tree),
});

export async function workflowFidelity(
  page: Page,
  report: ReturnType<typeof compile>['document'],
  enhanced: boolean,
  print = false,
) {
  await expect(page.locator('h1')).toHaveText(report.data.title);
  for (const block of report.blocks) {
    const region = page.locator(`#${block.id}`),
      data = block.data;
    switch (data.kind) {
      case 'richtext':
        await inline(
          region.locator(':scope > .semloom-richtext'),
          (data as RichTextBlock).content,
        );
        break;
      case 'list':
        await list(region.locator(':scope > .semloom-list'), data as ListBlock);
        break;
      case 'code':
        expect(await region.locator('pre > code').textContent()).toBe(
          (data as CodeBlock).text,
        );
        await expect(region.locator('pre')).toHaveCSS(
          'white-space',
          print ? 'pre-wrap' : 'pre',
        );
        break;
      case 'prose':
        expect(await region.locator(':scope > .prose').textContent()).toBe(
          (data as ProseBlock).text,
        );
        break;
      case 'comparison': {
        const comparison = data as ComparisonBlock;
        const cards =
          (await region.getAttribute('data-variant')) === 'comparison.cards';
        expect(
          await region
            .locator(
              cards ? '.comparison-card > :is(h2,h3,h4,h5,h6)' : 'tbody th',
            )
            .allTextContents(),
        ).toEqual(comparison.items.map((item) => item.name));
        expect(
          await region
            .locator(cards ? '.comparison-card dd' : 'tbody td')
            .allTextContents(),
        ).toEqual(
          comparison.items.flatMap((item) =>
            comparison.fields.map((field) =>
              String(item.attributes[field.key]),
            ),
          ),
        );
        expect(
          await region
            .locator(
              cards
                ? '.comparison-card:first-child dt'
                : 'thead th:not(:first-child)',
            )
            .allTextContents(),
        ).toEqual(comparison.fields.map((field) => field.label));
        break;
      }
      case 'hierarchy': {
        const wrapper = region.locator(':scope > .semloom-hierarchy');
        const mindmap =
          (await region.getAttribute('data-variant')) === 'hierarchy.mindmap';
        if (mindmap && enhanced && !print) {
          await expect(wrapper).toHaveAttribute('data-mindmap-ready', '');
          const actual = await wrapper
            .locator('svg.markmap')
            .evaluate((svg) => {
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
            });
          expect(actual).toEqual(tree((data as HierarchyBlock).root));
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
        } else {
          const root = wrapper.locator('.semloom-hierarchy-root > li');
          await expect(root).toBeVisible();
          const actual = await root.evaluate((element) => {
            function read(node: Element): object {
              return {
                label: node.querySelector(':scope > .semloom-hierarchy-label')!
                  .textContent,
                children: [...node.querySelectorAll(':scope > ul > li')].map(
                  read,
                ),
              };
            }
            return read(element);
          });
          expect(actual).toEqual(tree((data as HierarchyBlock).root));
        }
        break;
      }
      default:
        throw new Error(`Workflow assertion missing for ${data.kind}`);
    }
    expect(
      await region.locator(':scope > .citations a').allTextContents(),
    ).toEqual(
      (data.sourceIds ?? []).map(
        (id) => report.data.sources!.find((source) => source.id === id)!.title,
      ),
    );
  }
  const sections = report.sections.flatMap(
    function flatten(section): typeof report.sections {
      return [section, ...section.sections.flatMap(flatten)];
    },
  );
  expect(
    await page.locator('[data-toc] [data-section]').evaluateAll((links) =>
      links.map((link) => ({
        title: link.textContent,
        id: link.getAttribute('href')!.slice(1),
      })),
    ),
  ).toEqual(
    sections.map((section) => ({ title: section.title, id: section.id })),
  );
  await expect(page.locator('[data-toc-source]')).toHaveAttribute(
    'href',
    '#semloom-sources',
  );
  expect(await page.locator('.sources > ol > li').allTextContents()).toEqual(
    report.data.sources!.map((source) => source.title),
  );
  const brokenLinks = await page
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links
        .filter(
          (link) =>
            !document.getElementById(
              decodeURIComponent(link.getAttribute('href')!.slice(1)),
            ),
        )
        .map((link) => link.getAttribute('href')),
    );
  expect(brokenLinks).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
