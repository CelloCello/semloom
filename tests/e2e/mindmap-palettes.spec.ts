import { test, expect, type Locator } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, createPresentation, themeNames } from '../../dist/index.js';
import { expectedMindmapPalettes } from '../fixtures/mindmap-palettes.mjs';

const directory = resolve('reports/hierarchy/palettes');
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function colors(region: Locator, expected: string[]) {
  await expect(region).toHaveAttribute('data-mindmap-ready', '');
  await expect(region.locator('g.markmap-node')).toHaveCount(15);
  const actual = await region.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      variables: Array.from({ length: 6 }, (_, i) =>
        css.getPropertyValue(`--semloom-mindmap-branch-${i + 1}`).trim(),
      ),
      nodes: [...element.querySelectorAll('g.markmap-node')].map((node) => ({
        label: node.querySelector('foreignObject')!.textContent,
        line: getComputedStyle(node.querySelector('line')!).stroke,
        circle: node.querySelector('circle')
          ? getComputedStyle(node.querySelector('circle')!).stroke
          : null,
      })),
      accent: css.getPropertyValue('--accent').trim(),
    };
  });
  expect(actual.variables).toEqual(expected);
  expect(actual.nodes[0]!.line).toBe(rgb(actual.accent));
  expect(actual.nodes[0]!.circle).toBe(rgb(actual.accent));
  for (let i = 0; i < 7; i++) {
    const color = rgb(expected[i % 6]!);
    expect(actual.nodes[i * 2 + 1]!.line).toBe(color);
    expect(actual.nodes[i * 2 + 1]!.circle).toBe(color);
    expect(actual.nodes[i * 2 + 2]!.line).toBe(color);
  }
  await expect
    .poll(() =>
      region.locator('.markmap-foreign > div > div').evaluateAll((labels) => {
        const boxes = labels.map((label) => label.getBoundingClientRect());
        return labels.every((label, i) => {
          const box = boxes[i]!;
          return (
            box.width > 0 &&
            box.height > 0 &&
            label.scrollWidth <= label.clientWidth + 1 &&
            label.scrollHeight <= label.clientHeight + 1 &&
            boxes.every(
              (other, j) =>
                i === j ||
                Math.min(box.right, other.right) -
                  Math.max(box.left, other.left) <=
                  0.5 ||
                Math.min(box.bottom, other.bottom) -
                  Math.max(box.top, other.top) <=
                  0.5,
            )
          );
        });
      }),
    )
    .toBe(true);
}

test('Theme palettes retain branch identity, folding, narrow screens, print and external CSS overrides offline', async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(
    await readFile('examples/hierarchy-palettes.json', 'utf8'),
  );
  const original = structuredClone(input);
  const options = { overrides: { 'architecture-map': 'hierarchy.mindmap' } };
  const baselines = {
    document: compile(input, { ...options, layout: 'document' }).plan,
    sidebar: compile(input, { ...options, layout: 'sidebar' }).plan,
  };
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
    offline: true,
  });
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
    offline: true,
  });
  const page = await context.newPage(),
    plain = await noJs.newPage();
  const requests: string[] = [],
    errors: string[] = [];
  for (const session of [context, noJs])
    session.on('request', (request) => {
      if (/^https?:/u.test(request.url())) requests.push(request.url());
    });
  page.on('pageerror', (error) => errors.push(error.message));
  const widths = info.project.name === 'desktop' ? [1280, 701] : [375];
  for (const theme of themeNames) {
    for (const layout of ['document', 'sidebar'] as const) {
      const output = compile(input, { ...options, theme, layout });
      expect(output.document.data).toEqual(original);
      expect(output.plan).toEqual(baselines[layout]);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        const file = resolve(directory, `${theme}-${layout}-${width}.html`);
        await writeFile(file, output.html);
        await page.goto(pathToFileURL(file).href);
        const region = page.locator('#architecture-map > .semloom-hierarchy');
        await colors(region, expectedMindmapPalettes[theme]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (layout === 'document' && width === widths[0])
          await region.screenshot({
            path: resolve(directory, `${theme}-${info.project.name}.png`),
          });
        const toggle = region.getByRole('button', {
          name: /^(收合|展開) 研究$/u,
        });
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(region.locator('g.markmap-node')).toHaveCount(14);
        await page.emulateMedia({ media: 'print' });
        await expect(region.locator('svg')).toBeHidden();
        await expect(region.locator('[data-mindmap-fallback]')).toBeVisible();
        await expect(region.locator('.semloom-hierarchy-label')).toHaveCount(
          15,
        );
        await expect(
          region.locator('.semloom-hierarchy-label').first(),
        ).toHaveCSS('color', 'rgb(0, 0, 0)');
        await page.emulateMedia({ media: 'screen' });
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await colors(region, expectedMindmapPalettes[theme]);
        if (layout === 'document' && width === widths[0]) {
          await plain.goto(pathToFileURL(file).href);
          await expect(plain.locator('[data-mindmap-fallback]')).toBeVisible();
          await expect(plain.locator('.semloom-hierarchy-label')).toHaveCount(
            15,
          );
          await expect(plain.locator('svg.markmap')).toHaveCount(0);
        }
      }
    }
  }
  for (const scheme of ['light', 'dark'] as const) {
    const theme = {
      id: `external.${scheme}`,
      themeApiVersion: '1.0',
      tokens: {
        'color-scheme': scheme,
        ...(scheme === 'dark'
          ? {
              paper: '#15201d',
              surface: '#20322b',
              ink: '#edf4ef',
              accent: '#b3dbb7',
            }
          : {}),
      },
      css: `[data-theme="external.${scheme}"] .semloom-hierarchy-mindmap{--semloom-mindmap-branch-2:#${scheme === 'dark' ? 'aaccff' : '123456'}}`,
    };
    const catalog = createPresentation({ themes: [theme] });
    const output = compile(
      input,
      { ...options, theme: theme.id },
      undefined,
      catalog,
    );
    const file = resolve(directory, `${theme.id}-${info.project.name}.html`);
    await writeFile(file, output.html);
    await page.goto(pathToFileURL(file).href);
    const expected = [
      ...expectedMindmapPalettes[scheme === 'dark' ? 'midnight' : 'minimal'],
    ];
    expected[1] = scheme === 'dark' ? '#aaccff' : '#123456';
    await colors(
      page.locator('#architecture-map > .semloom-hierarchy'),
      expected,
    );
  }
  expect(input).toEqual(original);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
  await noJs.close();
});
