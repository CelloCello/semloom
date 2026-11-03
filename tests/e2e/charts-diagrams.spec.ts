import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  compile,
  themeNames,
  layoutNames,
  loadRegistry,
  loadPresentation,
  parseConfig,
  createPresentation,
} from '../../dist/index.js';
import {
  chartBlock,
  diagramBlock,
  diagramSources,
  visualDocument,
  fixedDomainCases,
} from '../fixtures/charts-diagrams.mjs';

const directory = resolve('reports/charts-diagrams');
const allBlocks = () => [
  chartBlock(),
  chartBlock({ orientation: 'horizontal' }),
  chartBlock({ chartType: 'line' }),
  chartBlock({
    chartType: 'donut',
    series: [{ key: 's', label: '數量', values: [10, 0, 20] }],
  }),
  ...Object.values(diagramSources).map((s) => diagramBlock(s)),
];

test('long line categories never collide and close value ticks remain distinct before and after enhancement/resize', async ({
  browser,
}, info) => {
  await mkdir(directory, { recursive: true });
  const labels = [
    '第一個非常長的分類名稱',
    '第二個非常長的分類名稱',
    '第三個非常長的分類名稱',
  ];
  const block = chartBlock({
    id: 'precise',
    chartType: 'line',
    categories: labels.map((label, i) => ({ key: String(i), label })),
    series: [{ key: 's', label: 'S', values: [1.000001, 1.000002, 1.000003] }],
  });
  const file = resolve(directory, `p2-line-${info.project.name}.html`);
  for (const js of [false, true]) {
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const theme of ['minimal', 'midnight']) {
      await writeFile(file, compile(visualDocument([block]), { theme }).html);
      await page.goto(pathToFileURL(file).href);
      if (js) await expect(page.locator('[data-chart-ready]')).toHaveCount(1);
      for (const width of [info.project.name === 'desktop' ? 1280 : 375, 701]) {
        await page.setViewportSize({ width, height: 900 });
        const svg = page.locator('.semloom-plot:visible svg');
        if (js)
          await expect
            .poll(() => svg.getAttribute('width'))
            .toBe(
              await page
                .locator('.semloom-chart')
                .evaluate((element) => String(element.clientWidth)),
            );
        await expect
          .poll(() =>
            svg.evaluate((element) => {
              const root = element.getBoundingClientRect();
              const texts = [...element.querySelectorAll('text')]
                .filter((text) => text.textContent?.trim())
                .map((text) => ({
                  text: text.textContent!,
                  rect: text.getBoundingClientRect(),
                }));
              const failures: string[] = [];
              for (const [i, a] of texts.entries()) {
                if (
                  a.rect.left < root.left - 1 ||
                  a.rect.right > root.right + 1
                )
                  failures.push(`clipped ${a.text}`);
                for (const b of texts.slice(i + 1)) {
                  const x =
                    Math.min(a.rect.right, b.rect.right) -
                    Math.max(a.rect.left, b.rect.left);
                  const y =
                    Math.min(a.rect.bottom, b.rect.bottom) -
                    Math.max(a.rect.top, b.rect.top);
                  if (x > 1 && y > 1)
                    failures.push(`collision ${a.text}/${b.text}`);
                }
              }
              const ticks = texts
                .map((t) => t.text)
                .filter((text) => Number.isFinite(Number(text)));
              if (new Set(ticks).size !== ticks.length)
                failures.push(`duplicate ticks ${ticks}`);
              return failures;
            }),
          )
          .toEqual([]);
        expect(
          await page.locator('.semloom-print-table tbody th').allTextContents(),
        ).toEqual(labels);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    await context.close();
  }
});

test('subnormal ticks remain distinct with original values before enhancement and after resize', async ({
  browser,
}, info) => {
  await mkdir(directory, { recursive: true });
  const values = [
    [Number.MIN_VALUE, null, 2 * Number.MIN_VALUE],
    [-2 * Number.MIN_VALUE, null, -Number.MIN_VALUE],
    [-Number.MIN_VALUE, null, Number.MIN_VALUE],
    [2 ** -1022 - Number.MIN_VALUE, null, 2 ** -1022 + Number.MIN_VALUE],
  ];
  const document = visualDocument(
    values.flatMap((values, i) =>
      [
        { chartType: 'line' },
        { chartType: 'bar', orientation: 'vertical' },
        { chartType: 'bar', orientation: 'horizontal' },
      ].map((type, j) =>
        chartBlock({
          ...type,
          id: `subnormal-${i}-${j}`,
          categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
          series: [{ key: 's', label: 'S', values }],
        }),
      ),
    ),
  );
  const file = resolve(directory, `subnormal-${info.project.name}.html`);
  await writeFile(file, compile(document).html);
  for (const js of [false, true]) {
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href);
    if (js) await expect(page.locator('[data-chart-ready]')).toHaveCount(12);
    for (const width of [info.project.name === 'desktop' ? 1280 : 375, 701]) {
      await page.setViewportSize({ width, height: 900 });
      const svgs = page.locator('.semloom-chart .semloom-plot:visible svg');
      await expect(svgs).toHaveCount(12);
      if (js)
        await expect
          .poll(() => svgs.first().getAttribute('width'))
          .toBe(
            await page
              .locator('.semloom-chart')
              .first()
              .evaluate((root) => String(root.clientWidth)),
          );
      await expect
        .poll(() =>
          svgs.evaluateAll((svgs) =>
            svgs.flatMap((svg, i) => {
              const ticks = [...svg.querySelectorAll('text')]
                .map((text) => text.textContent!)
                .filter((text) => !['A', 'B', 'C'].includes(text));
              return ticks.length >= 2 &&
                new Set(ticks).size === ticks.length &&
                ticks.every((t) => !/NaN|Infinity/u.test(t))
                ? []
                : [`chart ${i}: ${ticks}`];
            }),
          ),
        )
        .toEqual([]);
      expect(
        await page.locator('.semloom-print-table').allTextContents(),
      ).toEqual(expect.arrayContaining([expect.stringContaining('5e-324')]));
    }
    await context.close();
  }
});

for (const [scenario, outerValues] of [
  ['original', [1.23456789, 1.234568, 1.2345681]],
  ['outside-guard', fixedDomainCases[2]!],
] as const) {
  test(`close fixed domains retain the full-data scale through enhancement, legend, resize and print (${scenario})`, async ({
    browser,
  }, info) => {
    await mkdir(directory, { recursive: true });
    const document = visualDocument([
      chartBlock({
        id: 'fixed-domain',
        chartType: 'line',
        categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
        series: [
          {
            key: 'outer',
            label: 'Outer',
            values: [...outerValues],
          },
          {
            key: 'inner',
            label: 'Inner',
            values: [0.25, 0.5, 0.75].map(
              (fraction) =>
                outerValues[0]! +
                (outerValues[2]! - outerValues[0]!) * fraction,
            ),
          },
        ],
      }),
      diagramBlock('flowchart LR\n A -->|hello; click here| B'),
    ]);
    const file = resolve(
      directory,
      `fixed-domain-${scenario}-${info.project.name}.html`,
    );
    await writeFile(file, compile(document).html);
    for (const js of [false, true]) {
      const context = await browser.newContext({
        javaScriptEnabled: js,
        viewport: info.project.use.viewport,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      const chart = page.locator('.semloom-chart');
      if (js) await expect(chart).toHaveAttribute('data-chart-ready', '');
      const ticks = async (selector: string) =>
        (await chart.locator(selector + ' text').allTextContents()).filter(
          (t) => !['A', 'B', 'C'].includes(t),
        );
      const baseline = await ticks('.semloom-visual-wide svg');
      expect(baseline.length).toBeGreaterThanOrEqual(2);
      expect(new Set(baseline).size).toBe(baseline.length);
      expect(await ticks('.semloom-visual-narrow svg')).toEqual(baseline);
      expect(await ticks('.semloom-print-panel svg')).toEqual(baseline);
      await expect(
        page.locator('.semloom-diagram .semloom-plot:visible svg'),
      ).toContainText('hello; click here');
      if (js) {
        expect(await ticks('.semloom-chart-enhanced svg')).toEqual(baseline);
        const buttons = chart.locator(':scope > .semloom-visual-legend button');
        await buttons.first().click();
        await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
        expect(await ticks('.semloom-chart-enhanced svg')).toEqual(baseline);
        await page.setViewportSize({ width: 701, height: 900 });
        await expect
          .poll(() =>
            chart.locator('.semloom-chart-enhanced svg').getAttribute('width'),
          )
          .toBe(await chart.evaluate((root) => String(root.clientWidth)));
        expect(await ticks('.semloom-chart-enhanced svg')).toEqual(baseline);
      }
      await page.emulateMedia({ media: 'print' });
      await expect(chart.locator('.semloom-print-panel')).toBeVisible();
      await expect(chart.locator('.semloom-print-table')).toContainText(
        String(outerValues[0]),
      );
      expect(await ticks('.semloom-print-panel svg')).toEqual(baseline);
      await page.emulateMedia({ media: 'screen' });
      if (js)
        await expect(
          chart.locator(':scope > .semloom-visual-legend button').first(),
        ).toHaveAttribute('aria-pressed', 'false');
      await context.close();
    }
  });
}

test('scoped external component palette overrides return to readable light colors for print', async ({
  page,
}, info) => {
  await mkdir(directory, { recursive: true });
  const catalog = createPresentation({
    themes: [
      {
        id: 'test.visual',
        themeApiVersion: '1.0',
        tokens: {
          'color-scheme': 'dark',
          paper: '#151d2b',
          ink: '#e4eaf2',
          accent: '#7bc6db',
        },
        css: '[data-theme="test.visual"] .semloom-chart{--semloom-chart-series-1:#ffff00}[data-theme="test.visual"] .semloom-diagram{--pele-fg:#ffff00}',
      },
    ],
  });
  const file = resolve(directory, `scoped-palette-${info.project.name}.html`);
  await writeFile(
    file,
    compile(
      visualDocument([chartBlock({ id: 'static' }), diagramBlock()]),
      { theme: 'test.visual', overrides: { static: 'chart.static' } },
      undefined,
      catalog,
    ).html,
  );
  await page.goto(pathToFileURL(file).href);
  const chartColor = () =>
    page
      .locator('.semloom-chart')
      .evaluate((node) =>
        getComputedStyle(node)
          .getPropertyValue('--semloom-chart-series-1')
          .trim(),
      );
  expect(await chartColor()).toBe('#ffff00');
  await page.emulateMedia({ media: 'print' });
  expect(await chartColor()).toBe('#285744');
  expect(
    await page
      .locator('.semloom-diagram')
      .evaluate((node) =>
        getComputedStyle(node).getPropertyValue('--pele-fg').trim(),
      ),
  ).toBe('#000');
  await page.emulateMedia({ media: 'screen' });
  expect(await chartColor()).toBe('#ffff00');
});

test('all chart/diagram families retain natural readable vectors, source, table and local scrolling without JS', async ({
  browser,
}, info) => {
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/u.test(request.url())) requests.push(request.url());
  });
  for (const theme of ['minimal', 'midnight']) {
    const document = visualDocument(allBlocks());
    const file = resolve(
      directory,
      `${theme}-${info.project.name}-static.html`,
    );
    await writeFile(file, compile(document, { theme }).html);
    await page.goto(pathToFileURL(file).href);
    expect(await page.locator('figure.semloom-visual').count()).toBe(9);
    for (const width of [info.project.name === 'desktop' ? 1280 : 375, 701]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(await page.locator('.semloom-plot:visible').count()).toBe(9);
      const geometry = await page
        .locator('.semloom-plot:visible svg')
        .evaluateAll((nodes) => {
          const errors: string[] = [];
          for (const svg of nodes as SVGSVGElement[]) {
            const root = svg.getBoundingClientRect();
            for (const node of svg.querySelectorAll('text')) {
              const box = node.getBoundingClientRect();
              const size = parseFloat(getComputedStyle(node).fontSize);
              if (size < 12) errors.push(`small ${node.textContent}: ${size}`);
              if (
                box.left < root.left - 1 ||
                box.right > root.right + 1 ||
                box.top < root.top - 1 ||
                box.bottom > root.bottom + 1
              )
                errors.push(`clipped ${node.textContent}`);
            }
          }
          return errors;
        });
      expect(geometry).toEqual([]);
    }
    const ids = await page
      .locator('[id]')
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const [i, source] of Object.values(diagramSources).entries()) {
      await page.locator('.semloom-diagram-source summary').nth(i).click();
      expect(
        await page.locator('.semloom-diagram-source code').nth(i).textContent(),
      ).toBe(source);
    }
    await page
      .locator('.semloom-chart-table-disclosure summary')
      .first()
      .click();
    await expect(
      page.locator('.semloom-chart-table-disclosure').first(),
    ).toContainText('未提供');
    await expect(
      page.locator('.semloom-chart-table-disclosure').first(),
    ).toContainText('-12');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.semloom-print-table').first()).toBeVisible();
    await expect(page.locator('.semloom-plot').first()).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  }
  expect(requests).toEqual([]);
  await context.close();
});

test('mixed vectors follow every Theme/Layout and share markup while retaining IDs and original data', async ({
  page,
}, info) => {
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, `matrix-${info.project.name}.html`);
  for (const theme of themeNames)
    for (const layout of layoutNames) {
      await writeFile(file, compile(visualDocument(), { theme, layout }).html);
      await page.goto(pathToFileURL(file).href);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const color = await page
        .locator('.semloom-chart svg path[ecmeta_series_index="0"]')
        .first()
        .evaluate((p) => getComputedStyle(p).fill);
      expect(color).not.toBe('');
      await expect(page.locator('.semloom-plot:visible')).toHaveCount(6);
    }
});

test('100-category grouped bars produce readable A4 panels and complete data without JavaScript', async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'One PDF per orientation is sufficient.',
  );
  await mkdir(directory, { recursive: true });
  const categories = Array.from({ length: 100 }, (_, i) => ({
    key: String(i),
    label: `第${String(i + 1).padStart(3, '0')}項文件匯入格式整理與驗證作業`,
  }));
  const series = Array.from({ length: 6 }, (_, i) => ({
    key: String(i),
    label: `數列${i + 1}`,
    values: categories.map((_, j) =>
      j % 4 === 0 ? null : j % 3 === 0 ? -j : j * i,
    ),
  }));
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const orientation of ['horizontal', 'vertical']) {
    const file = resolve(directory, `print-${orientation}.html`);
    const document = {
      ...visualDocument([
        chartBlock({ orientation, categories, series, sourceIds: ['sample'] }),
      ]),
      sources: [{ id: 'sample', title: '合成測試資料' }],
    };
    await writeFile(file, compile(document, { theme: 'midnight' }).html);
    await page.goto(pathToFileURL(file).href);
    await page.emulateMedia({ media: 'print' });
    const panels = await page
      .locator('.semloom-print-panel')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          start: Number((node as HTMLElement).dataset.start),
          end: Number((node as HTMLElement).dataset.end),
          domain: (node as HTMLElement).dataset.domain,
          height: node.getBoundingClientRect().height,
        })),
      );
    expect(panels[0]!.start).toBe(0);
    expect(panels.at(-1)!.end).toBe(100);
    expect(new Set(panels.map((p) => p.domain)).size).toBe(1);
    for (let i = 1; i < panels.length; i++)
      expect(panels[i]!.start).toBe(panels[i - 1]!.end);
    await page.pdf({
      path: resolve(directory, `print-${orientation}.pdf`),
      format: 'A4',
      margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
      printBackground: true,
    });
  }
  await context.close();
});

test('progressive charts use safe tooltips, independently keyed legends, stable axes, reduced motion and static print', async ({
  page,
}, info) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/u.test(request.url())) requests.push(request.url());
  });
  const block = chartBlock({
    id: 'chart',
    series: [
      { key: '__proto__', label: '同名數列', values: [128, 64, null] },
      { key: 'hasOwnProperty', label: '同名數列', values: [104, -12, 112] },
    ],
  });
  const file = resolve(directory, `enhanced-${info.project.name}.html`);
  await writeFile(
    file,
    compile(
      visualDocument([
        block,
        chartBlock({
          id: 'donut',
          chartType: 'donut',
          series: [{ key: 's', label: '值', values: [3, 0, 2] }],
        }),
        diagramBlock(),
      ]),
      { interactive: false },
    ).html,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(file).href);
  const chart = page.locator('#chart .semloom-chart');
  await expect(chart).toHaveAttribute('data-chart-ready', '');
  await expect(chart.locator('.semloom-chart-screen')).toBeHidden();
  await expect(chart.locator('.semloom-chart-enhanced')).toBeVisible();
  expect(
    await chart
      .locator('.semloom-chart-enhanced')
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
  const buttons = chart.locator(':scope > .semloom-visual-legend button');
  await expect(buttons).toHaveCount(2);
  const axes = await chart
    .locator('.semloom-chart-enhanced svg text')
    .allTextContents();
  const before = await chart
    .locator('.semloom-chart-enhanced svg path')
    .count();
  await buttons.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(buttons.nth(1)).toBeDisabled();
  await expect
    .poll(() => chart.locator('.semloom-chart-enhanced svg path').count())
    .toBeLessThan(before);
  expect(
    await chart.locator('.semloom-chart-enhanced svg text').allTextContents(),
  ).toEqual(axes);
  await page.emulateMedia({ media: 'print' });
  await expect(chart.locator('.semloom-chart-enhanced')).toBeHidden();
  await expect(chart.locator('.semloom-print-panels')).toBeVisible();
  await expect(chart.locator('.semloom-print-table')).toContainText('128');
  await page.emulateMedia({ media: 'screen' });
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await buttons.nth(0).click();
  await expect(buttons.nth(1)).toBeEnabled();
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 701, height: 900 });
  await expect
    .poll(() =>
      chart.locator('.semloom-chart-enhanced svg').getAttribute('width'),
    )
    .toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // ECharts assigns the first series' semantic color to its bars; the second
  // category deliberately repeats a label, so its value proves index identity.
  const color = await chart.evaluate((e) =>
    getComputedStyle(e).getPropertyValue('--semloom-chart-series-1').trim(),
  );
  const bars = chart.locator(
    `.semloom-chart-enhanced svg path[fill="${color}"]`,
  );
  await expect(bars).toHaveCount(2);
  const heights = await bars.evaluateAll((nodes) =>
    nodes.map((node) => (node as SVGGraphicsElement).getBBox().height),
  );
  expect(heights[0]! / heights[1]!).toBeCloseTo(2, 1);
  await bars.nth(1).hover();
  await expect(chart.locator('.semloom-chart-tooltip')).toBeVisible();
  await expect(chart.locator('.semloom-chart-tooltip')).toContainText('64 件');
  await expect(chart.locator('.semloom-chart-tooltip')).toContainText('-12 件');
  expect(await page.locator('main').innerText()).not.toContain('semloom-key-');
  await expect(
    page.locator('#donut > figure > .semloom-visual-legend button'),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test('touch and English controls preserve exact category values and permit data-table access', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'One touch context is sufficient.');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, 'touch-en.html');
  const document = {
    ...visualDocument([
      chartBlock({
        id: 'chart',
        series: [{ key: 's', label: 'Count', values: [128, 64, 90] }],
      }),
    ]),
    locale: 'en-US',
  };
  await writeFile(file, compile(document).html);
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('[data-chart-ready]')).toHaveCount(1);
  const color = await page
    .locator('#chart figure')
    .evaluate((e) =>
      getComputedStyle(e).getPropertyValue('--semloom-chart-series-1').trim(),
    );
  await page
    .locator(`.semloom-chart-enhanced svg path[fill="${color}"]`)
    .nth(1)
    .tap();
  await expect(page.locator('.semloom-chart-tooltip')).toContainText('64 件');
  await page.getByText('Chart data', { exact: true }).tap();
  await expect(
    page.locator('.semloom-chart-table-disclosure table'),
  ).toBeVisible();
  await expect(page.locator('.semloom-visual-legend button')).toHaveAttribute(
    'aria-label',
    'Toggle series: Count',
  );
  await context.close();
});

for (const js of [true, false])
  test(`initial/edit visual workflow preserves facts across external paper/night and right TOC; JS=${js}`, async ({
    browser,
  }, info) => {
    await mkdir(directory, { recursive: true });
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      offline: true,
    });
    const page = await context.newPage();
    const results = [];
    for (const phase of ['initial', 'edited']) {
      const input = JSON.parse(
        await readFile(
          resolve(`examples/visual-workflow-${phase}.json`),
          'utf8',
        ),
      );
      for (const theme of ['paper', 'night']) {
        const config = parseConfig(
          JSON.parse(
            await readFile(
              resolve(`examples/visual-workflow-${theme}.json`),
              'utf8',
            ),
          ),
        );
        const catalog = await loadPresentation(config, resolve('examples'));
        const result = compile(input, config, undefined, catalog);
        const file = resolve(
          directory,
          `workflow-${phase}-${theme}-${info.project.name}-${js}.html`,
        );
        await writeFile(file, result.html);
        await page.goto(pathToFileURL(file).href);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          `example.${theme}`,
        );
        await expect(page.locator('[data-chart-ready]')).toHaveCount(
          js ? 2 : 0,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        for (const block of input.sections[0].blocks) {
          if (block.kind === 'chart') {
            const chart = page.locator(`#${block.id}`);
            const rows = await chart
              .locator('.semloom-print-table tbody tr')
              .evaluateAll((nodes) =>
                nodes.map((node) =>
                  [...node.querySelectorAll('th,td')].map(
                    (cell) => cell.textContent,
                  ),
                ),
              );
            expect(rows).toEqual(
              block.categories.map((category: { label: string }, i: number) => [
                category.label,
                ...block.series.map((s: { values: (number | null)[] }) =>
                  s.values[i] === null ? '未提供' : String(s.values[i]),
                ),
              ]),
            );
            await expect(chart.locator('.citations')).toContainText('合成數據');
          } else if (block.kind === 'diagram') {
            expect(
              await page
                .locator(`#${block.id} .semloom-diagram-source code`)
                .textContent(),
            ).toBe(block.source);
            await expect(page.locator(`#${block.id} .citations`)).toContainText(
              'Pele API',
            );
          }
        }
        await page.emulateMedia({ media: 'print' });
        await expect(
          page.locator('.semloom-print-table').first(),
        ).toBeVisible();
        await page.emulateMedia({ media: 'screen' });
        results.push({
          phase,
          theme,
          blocks: result.document.blocks.map((b) => ({
            id: b.id,
            data: b.data,
          })),
        });
      }
    }
    expect(results[0]!.blocks).toEqual(results[1]!.blocks);
    expect(results[2]!.blocks).toEqual(results[3]!.blocks);
    await context.close();
  });

test('failed chart initialization retains SSR; successful View replacement and removal release initial engines', async ({
  browser,
}, info) => {
  await mkdir(directory, { recursive: true });
  const registry = await loadRegistry(
    ['./tests/fixtures/chart-extension.mjs'],
    resolve('.'),
  );
  const file = resolve(directory, `lifecycle-${info.project.name}.html`);
  await writeFile(
    file,
    compile(
      visualDocument([
        chartBlock({ id: 'chart' }),
        chartBlock({ id: 'other' }),
      ]),
      { interactive: true },
      registry,
    ).html,
  );
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const Native = window.ResizeObserver;
    const state = { active: 0 };
    Object.assign(window, { chartResources: state });
    window.ResizeObserver = class extends Native {
      private counted = false;
      observe(target: Element, options?: ResizeObserverOptions) {
        if (!this.counted) {
          state.active++;
          this.counted = true;
        }
        super.observe(target, options);
      }
      disconnect() {
        if (this.counted) {
          state.active--;
          this.counted = false;
        }
        super.disconnect();
      }
    };
  });
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('[data-chart-ready]')).toHaveCount(2);
  const active = () =>
    page.evaluate(
      () =>
        (window as unknown as { chartResources: { active: number } })
          .chartResources.active,
    );
  expect(await active()).toBe(2);
  const selector = page.locator('#chart select');
  await selector.selectOption('test.chart.fail');
  await expect(page.locator('#chart [data-chart-ready]')).toHaveCount(1);
  expect(await active()).toBe(2);
  await selector.selectOption('test.chart.one');
  await expect(page.locator('#chart [data-chart-ready]')).toHaveCount(0);
  expect(await active()).toBe(1);
  await expect(page.locator('#other [data-chart-ready]')).toHaveCount(1);
  await page.locator('#other').evaluate((node) => node.remove());
  await expect.poll(active).toBe(0);
  await context.close();
  const failure = await browser.newContext({
    viewport: info.project.use.viewport,
  });
  const fallback = await failure.newPage();
  await fallback.addInitScript(() => {
    window.ResizeObserver = class {
      constructor() {
        throw new Error('Test setup failure.');
      }
    } as unknown as typeof ResizeObserver;
  });
  await fallback.goto(pathToFileURL(file).href);
  await expect(fallback.locator('[data-chart-ready]')).toHaveCount(0);
  await expect(fallback.locator('#chart .semloom-chart-screen')).toBeVisible();
  await expect(fallback.locator('#chart .semloom-chart-enhanced')).toHaveCount(
    0,
  );
  await failure.close();
});

test('installed chart/diagram reader artifacts preserve the exact archive output offline and without JavaScript', async ({
  browser,
}, info) => {
  const receiptFile = process.env.SEMLOOM_VISUAL_RECEIPT;
  test.skip(!receiptFile, 'Requires an actual installed-package receipt.');
  const receipt = JSON.parse(await readFile(receiptFile!, 'utf8'));
  for (const js of [true, false]) {
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      offline: true,
    });
    const page = await context.newPage();
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    context.on('request', (request) => {
      if (/^https?:/u.test(request.url())) requests.push(request.url());
    });
    for (const [name, chartCount, diagramCount] of [
      ['charts', 4, 0],
      ['charts-static', 4, 0],
      ['fixed-domain', 1, 0],
      ['fixed-domain-static', 1, 0],
      ['diagrams', 0, 5],
      ['visual-workflow-initial', 2, 2],
      ['visual-workflow-edited', 2, 2],
    ] as const) {
      const artifact = receipt.outputs[name];
      expect(
        createHash('sha256')
          .update(await readFile(artifact.path))
          .digest('hex'),
      ).toBe(artifact.sha256);
      await page.goto(pathToFileURL(artifact.path).href);
      await expect(page.locator('.semloom-chart')).toHaveCount(chartCount);
      await expect(page.locator('.semloom-diagram')).toHaveCount(diagramCount);
      await expect(page.locator('[data-chart-ready]')).toHaveCount(
        js && !name.endsWith('-static') ? chartCount : 0,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.semloom-print-table').first()).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
    }
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
    await context.close();
  }
});
