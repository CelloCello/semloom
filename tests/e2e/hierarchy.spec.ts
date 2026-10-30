import { test, expect, type Locator } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  createPresentation,
  parseConfig,
  loadPresentation,
  hierarchyLimits,
  type HierarchyNode,
} from '../../dist/index.js';
import {
  hierarchyDocument,
  hierarchyChain,
  hierarchyWide,
  hierarchyAsymmetric,
} from '../fixtures/hierarchy.mjs';

const directory = resolve('reports/hierarchy');
const outline = (node: HierarchyNode): object => ({
  label: node.label,
  children: (node.children ?? []).map(outline),
});
const count = (node: HierarchyNode): number =>
  1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
async function fallback(region: Locator, root: HierarchyNode) {
  const result = await region
    .locator('.semloom-hierarchy-root > li')
    .evaluate((element) => {
      function read(node: Element): object {
        return {
          label: node.querySelector(':scope > .semloom-hierarchy-label')!
            .textContent,
          children: [...node.querySelectorAll(':scope > ul > li')].map(read),
        };
      }
      return read(element);
    });
  expect(result).toEqual(outline(root));
}
async function geometry(labels: Locator) {
  await expect
    .poll(() =>
      labels.evaluateAll((nodes) => {
        const boxes = nodes.map((node) => node.getBoundingClientRect());
        for (let i = 0; i < boxes.length; i++) {
          const box = boxes[i]!;
          const node = nodes[i] as HTMLElement;
          if (
            box.width <= 0 ||
            box.height <= 0 ||
            node.scrollWidth > node.clientWidth + 1 ||
            node.scrollHeight > node.clientHeight + 1
          )
            return { clipped: i };
          for (let j = i + 1; j < boxes.length; j++) {
            const other = boxes[j]!;
            if (
              Math.min(box.right, other.right) -
                Math.max(box.left, other.left) >
                0.5 &&
              Math.min(box.bottom, other.bottom) -
                Math.max(box.top, other.top) >
                0.5
            )
              return { overlap: [i, j] };
          }
        }
        return null;
      }),
    )
    .toBeNull();
}
async function markmap(region: Locator, root: HierarchyNode) {
  await expect(region).toHaveAttribute('data-mindmap-ready', '');
  await expect(region.locator('g.markmap-node')).toHaveCount(count(root));
  const result = await region.locator('svg.markmap').evaluate((svg) => {
    const nodes = [...svg.querySelectorAll('g.markmap-node')].map((node) => ({
      path: node.getAttribute('data-path')!,
      label: node.querySelector('foreignObject')!.textContent,
    }));
    function read(path: string): object {
      return {
        label: nodes.find((node) => node.path === path)!.label,
        children: nodes
          .filter(
            (node) => node.path.slice(0, node.path.lastIndexOf('.')) === path,
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
  expect(result).toEqual(outline(root));
  await geometry(region.locator('.markmap-foreign > div > div'));
  const labels = (node: HierarchyNode): string[] => [
    node.label,
    ...(node.children ?? []).flatMap(labels),
  ];
  await expect
    .poll(() => region.locator('.markmap-foreign').allTextContents())
    .toEqual(labels(root));
  const edges = await region.locator('svg.markmap').evaluate((svg) => {
    const groups = new Map(
      [...svg.querySelectorAll('g.markmap-node')].map((node) => [
        node.getAttribute('data-path'),
        node,
      ]),
    );
    const point = (element: SVGGraphicsElement, x: number, y: number) =>
      new DOMPoint(x, y).matrixTransform(element.getScreenCTM()!);
    for (const edge of svg.querySelectorAll<SVGPathElement>(
      'path.markmap-link',
    )) {
      const path = edge.getAttribute('data-path')!;
      const child = groups.get(path)!;
      const parent = groups.get(path.slice(0, path.lastIndexOf('.')))!;
      const circle = parent.querySelector('circle')!;
      const line = child.querySelector('line')!;
      const start = edge.getPointAtLength(0),
        end = edge.getPointAtLength(edge.getTotalLength());
      const a = point(edge, start.x, start.y),
        b = point(edge, end.x, end.y);
      const c = point(circle, circle.cx.baseVal.value, circle.cy.baseVal.value),
        d = point(line, line.x1.baseVal.value, line.y1.baseVal.value);
      if (
        Math.hypot(a.x - c.x, a.y - c.y) > 1.1 ||
        Math.hypot(b.x - d.x, b.y - d.y) > 1.1
      )
        return { joint: path };
      if (getComputedStyle(edge).stroke !== getComputedStyle(line).stroke)
        return { color: path };
    }
    return null;
  });
  expect(edges).toBeNull();
}
async function pageWidth(page: import('@playwright/test').Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const variant of ['hierarchy.tree', 'hierarchy.mindmap'])
  for (const js of [true, false]) {
    test(`${variant} initial/edit across Theme/Layout; JS=${js}`, async ({
      browser,
    }, info) => {
      test.setTimeout(60000);
      await mkdir(directory, { recursive: true });
      const config = JSON.parse(
        await readFile('examples/hierarchy-mindmap.json', 'utf8'),
      );
      const presentation = await loadPresentation(
        parseConfig(config),
        resolve('examples'),
      );
      const context = await browser.newContext({
        javaScriptEnabled: js,
        viewport: info.project.use.viewport,
        offline: true,
      });
      const page = await context.newPage();
      const requests: string[] = [],
        errors: string[] = [];
      context.on('request', (request) => {
        if (/^https?:/u.test(request.url())) requests.push(request.url());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      for (const theme of ['minimal', 'example.paper', 'example.night'])
        for (const layout of ['document', 'sidebar', 'example.right-sidebar'])
          for (const edited of [false, true]) {
            const input = hierarchyDocument(edited),
              root = input.sections[0].blocks[1].root;
            const output = compile(
              input,
              {
                ...config,
                theme,
                layout,
                interactive: true,
                overrides: { 'architecture-map': variant },
              },
              undefined,
              presentation,
            );
            const file = resolve(
              directory,
              `${info.project.name}-markmap-${variant}-${js}-${theme}-${layout}-${edited}.html`,
            );
            await writeFile(file, output.html);
            await page.goto(pathToFileURL(file).href);
            const region = page.locator(
              '#architecture-map > .semloom-hierarchy',
            );
            expect(output.plan.blocks[1]!.selected).toBe(variant);
            await expect(page.locator('#architecture-map')).toHaveAttribute(
              'data-variant',
              variant,
            );
            await fallback(region, root);
            if (js && variant === 'hierarchy.mindmap') {
              await markmap(region, root);
              await expect(
                region.locator('[data-mindmap-fallback]'),
              ).toBeHidden();
              await expect(region.locator('svg.markmap')).toHaveCSS(
                'color',
                theme === 'minimal'
                  ? 'rgb(36, 41, 35)'
                  : theme === 'example.paper'
                    ? 'rgb(40, 43, 38)'
                    : 'rgb(237, 244, 239)',
              );
            } else await geometry(region.locator('.semloom-hierarchy-label'));
            await expect(
              page.locator('#architecture-map > .citations a'),
            ).toHaveCount(2);
            await expect(page.locator('[data-section]')).toHaveCount(1);
            await expect(page.locator('[data-switcher]')).toHaveCount(0);
            await pageWidth(page);
            await page.emulateMedia({ media: 'print' });
            await fallback(region, root);
            await geometry(region.locator('.semloom-hierarchy-label'));
            await expect(region.locator('svg')).toBeHidden();
            await expect(page.locator('.sources')).toBeVisible();
            await expect(
              page.locator('#architecture-map > .citations'),
            ).toBeVisible();
            await pageWidth(page);
            await page.emulateMedia({ media: 'screen' });
            if (
              js &&
              variant === 'hierarchy.mindmap' &&
              !edited &&
              layout === 'document'
            ) {
              await page.screenshot({
                path: resolve(
                  directory,
                  `markmap-${theme}-${info.project.name}.png`,
                ),
                fullPage: true,
              });
            }
          }
      await page.reload();
      await fallback(
        page.locator('#architecture-map > .semloom-hierarchy'),
        hierarchyDocument(true).sections[0].blocks[1].root,
      );
      if (js && variant === 'hierarchy.mindmap')
        await markmap(
          page.locator('#architecture-map > .semloom-hierarchy'),
          hierarchyDocument(true).sections[0].blocks[1].root,
        );
      expect(requests).toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

for (const js of [true, false])
  test(`hierarchy bounded and asymmetric trees preserve all content; JS=${js}`, async ({
    browser,
  }, info) => {
    test.setTimeout(90000);
    await mkdir(directory, { recursive: true });
    const roots: Record<string, HierarchyNode> = {
      leaf: { label: '單節點', children: [] },
      deep: hierarchyChain(8, '長中文階層：必須完整保留的層級'),
      wide: hierarchyWide(hierarchyLimits.nodes),
      asymmetric: hierarchyAsymmetric(),
      long: {
        label: '長文字',
        children: [
          { label: '長中文'.repeat(200) },
          {
            label: 'long'.repeat(250),
            children: [
              {
                label:
                  '</div></script><img src="https://invalid.example/a" onerror="alert(1)"> **literal** &',
              },
            ],
          },
          { label: '多行\n  保留空白\n末行' },
        ],
      },
    };
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      offline: true,
    });
    const page = await context.newPage();
    for (const variant of ['hierarchy.tree', 'hierarchy.mindmap'])
      for (const [name, root] of Object.entries(roots)) {
        const file = resolve(
          directory,
          `${info.project.name}-markmap-boundary-${variant}-${js}-${name}.html`,
        );
        await writeFile(
          file,
          compile(
            {
              schemaVersion: '1.0',
              title: '邊界',
              sections: [
                {
                  title: '內容',
                  blocks: [{ kind: 'hierarchy', id: 'map', root }],
                },
              ],
            },
            { overrides: { map: variant } },
          ).html,
        );
        await page.goto(pathToFileURL(file).href);
        const region = page.locator('#map > .semloom-hierarchy');
        await fallback(region, root);
        if (js && variant === 'hierarchy.mindmap') {
          await markmap(region, root);
          if (name === 'deep') {
            const diagram = region.locator('.semloom-mindmap-diagram');
            expect(
              await diagram.evaluate(
                (node) => node.scrollWidth > node.clientWidth,
              ),
            ).toBe(true);
            await diagram.scrollIntoViewIfNeeded();
            await diagram.focus();
            await diagram.press('ArrowRight');
            await expect
              .poll(() => diagram.evaluate((node) => node.scrollLeft))
              .toBeGreaterThan(0);
            const last = region.locator('.markmap-foreign').last();
            await last.scrollIntoViewIfNeeded();
            await expect(last).toBeInViewport();
          }
        } else await geometry(region.locator('.semloom-hierarchy-label'));
        await expect(page.locator('img,[onerror]')).toHaveCount(0);
        await pageWidth(page);
        await page.emulateMedia({ media: 'print' });
        await fallback(region, root);
        await geometry(region.locator('.semloom-hierarchy-label'));
        await pageWidth(page);
        await page.emulateMedia({ media: 'screen' });
      }
    await context.close();
  });

test('701px/375px retain real Markmap with mouse/keyboard folding, independent comparison switching and complete print', async ({
  browser,
}, info) => {
  await mkdir(directory, { recursive: true });
  const width = info.project.name === 'desktop' ? 701 : 375;
  const input = hierarchyDocument();
  input.sections[0].blocks.push({
    kind: 'comparison',
    id: 'compare',
    subject: '工具',
    fields: [{ key: 'x', label: 'X' }],
    items: [
      { name: 'A', attributes: { x: 1 } },
      { name: 'B', attributes: { x: 2 } },
    ],
  });
  const root = input.sections[0].blocks[1].root;
  input.sections[0].blocks.push({
    kind: 'hierarchy',
    id: 'other-map',
    root: { label: '其他圖', children: [{ label: '保持展開' }] },
  });
  const file = resolve(directory, `markmap-fold-${width}.html`);
  await writeFile(
    file,
    compile(input, {
      interactive: true,
      overrides: {
        'architecture-map': 'hierarchy.mindmap',
        'other-map': 'hierarchy.mindmap',
      },
    }).html,
  );
  const context = await browser.newContext({
    viewport: { width, height: 852 },
    offline: true,
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(file).href);
  const region = page.locator('#architecture-map > .semloom-hierarchy');
  await markmap(region, root);
  await pageWidth(page);
  const total = count(root),
    closed = total - count(root.children[0]) + 1;
  await region
    .getByRole('button', { name: '收合 內容能力', exact: true })
    .click();
  await expect(region.locator('g.markmap-node')).toHaveCount(closed);
  await expect(page.locator('#other-map g.markmap-node')).toHaveCount(2);
  await expect(
    page
      .locator('#other-map')
      .getByRole('button', { name: '收合 其他圖', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  const toggle = region.getByRole('button', {
    name: /^(展開|收合) 內容能力$/u,
  });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#compare select').selectOption('comparison.table');
  await expect(region.locator('g.markmap-node')).toHaveCount(closed);
  await page.emulateMedia({ media: 'print' });
  await fallback(region, root);
  await geometry(region.locator('.semloom-hierarchy-label'));
  await expect(region.locator('svg')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(region.locator('g.markmap-node')).toHaveCount(closed);
  await toggle.focus();
  await toggle.press('Enter');
  await expect(region.locator('g.markmap-node')).toHaveCount(total);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  await toggle.press(' ');
  await expect(region.locator('g.markmap-node')).toHaveCount(closed);
  await toggle.press(' ');
  await markmap(region, root);
  expect(
    await region.locator('svg.markmap > g').first().getAttribute('transform'),
  ).toBeNull();
  await page.screenshot({
    path: resolve(directory, `markmap-fold-${width}.png`),
    fullPage: true,
  });
  await context.close();
});

test('Markmap initialization failure keeps full fallback and citations', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
    offline: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'ResizeObserver', {
      value: class {
        constructor() {
          throw new Error('forced setup failure');
        }
      },
    });
  });
  const input = hierarchyDocument(),
    file = resolve(directory, `${info.project.name}-markmap-failure.html`);
  await writeFile(
    file,
    compile(input, { overrides: { 'architecture-map': 'hierarchy.mindmap' } })
      .html,
  );
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  const region = page.locator('#architecture-map > .semloom-hierarchy');
  await expect(region.locator('.semloom-mindmap-diagram')).toBeHidden();
  await fallback(region, input.sections[0].blocks[1].root);
  await geometry(region.locator('.semloom-hierarchy-label'));
  await expect(page.locator('#architecture-map > .citations a')).toHaveCount(2);
  expect(errors).toEqual([]);
  await context.close();
});

test('actual Markmap matches the reference, receives Theme palette and prints complete text', async ({
  browser,
}, info) => {
  const input = JSON.parse(
    await readFile('examples/hierarchy-reference.json', 'utf8'),
  );
  const presentation = createPresentation({
    themes: ['light', 'dark'].map((tone) => ({
      id: `reference.${tone}`,
      themeApiVersion: '1.0',
      tokens: {
        paper: tone === 'dark' ? '#262728' : '#faf9f6',
        ink: tone === 'dark' ? '#eeeeee' : '#242923',
        accent: '#2c7fb8',
        'color-scheme': tone,
      },
      css: `[data-theme='reference.${tone}'] .semloom-hierarchy-mindmap{font-size:2rem;--semloom-mindmap-branch-1:#ff8b06;--semloom-mindmap-branch-2:#299b28;--semloom-mindmap-branch-3:#e02d2f;--semloom-mindmap-branch-4:#a774c7}`,
    })),
  });
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
    offline: true,
  });
  const page = await context.newPage();
  for (const tone of ['light', 'dark']) {
    const file = resolve(directory, `markmap-reference-${tone}.html`);
    await writeFile(
      file,
      compile(
        input,
        {
          theme: `reference.${tone}`,
          overrides: { 'visual-map': 'hierarchy.mindmap' },
        },
        undefined,
        presentation,
      ).html,
    );
    await page.goto(pathToFileURL(file).href);
    const region = page.locator('.semloom-hierarchy-mindmap');
    await markmap(region, input.sections[0].blocks[0].root);
    await expect(
      region.getByRole('button', { name: '收合 markmap', exact: true }),
    ).toHaveCount(1);
    const colors = await region
      .locator('.markmap-node')
      .evaluateAll((nodes) =>
        Object.fromEntries(
          nodes.map((node) => [
            node.querySelector('foreignObject')!.textContent,
            getComputedStyle(node.querySelector('line')!).stroke,
          ]),
        ),
      );
    expect(colors).toEqual({
      markmap: 'rgb(44, 127, 184)',
      beautiful: 'rgb(255, 139, 6)',
      useful: 'rgb(41, 155, 40)',
      easy: 'rgb(224, 45, 47)',
      interactive: 'rgb(167, 116, 199)',
    });
    await region
      .locator(
        info.project.name === 'desktop'
          ? 'svg.markmap'
          : '.semloom-mindmap-diagram',
      )
      .screenshot({
        path: resolve(
          directory,
          `markmap-reference-${tone}-${info.project.name}.png`,
        ),
      });
    await page.emulateMedia({ media: 'print' });
    await fallback(region, input.sections[0].blocks[0].root);
    await geometry(region.locator('.semloom-hierarchy-label'));
    await region.locator('[data-mindmap-fallback]').screenshot({
      path: resolve(
        directory,
        `markmap-reference-${tone}-${info.project.name}-print.png`,
      ),
    });
    await page.emulateMedia({ media: 'screen' });
  }
  await context.close();
});
