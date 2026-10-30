import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  parseConfig,
  loadPresentation,
  themeNames,
} from '../../dist/index.js';
import type { ComparisonBlock } from '../../dist/index.js';

const directory = resolve('reports/reading');
async function setup() {
  const input = JSON.parse(
    await readFile('examples/reading-report.json', 'utf8'),
  );
  const config = parseConfig(
    JSON.parse(await readFile('examples/reading-presentation.json', 'utf8')),
  );
  const catalog = await loadPresentation(config, resolve('examples'));
  await mkdir(directory, { recursive: true });
  return { input, config, catalog };
}

async function fidelity(page: Page, output: ReturnType<typeof compile>) {
  await expect(page.locator('h1')).toHaveText(output.document.data.title);
  expect(
    await page.locator('[data-toc] [data-section]').allTextContents(),
  ).toEqual(output.document.data.sections.map((s) => s.title));
  await expect(page.locator('[data-toc-source]')).toHaveAttribute(
    'href',
    '#semloom-sources',
  );
  const blocks = output.document.blocks;
  expect(
    await page
      .locator('main .block')
      .evaluateAll((nodes) => nodes.map((n) => n.id)),
  ).toEqual(blocks.map((b) => b.id));
  for (const { id, data } of blocks) {
    const region = page.locator(`#${id}`);
    await expect(region).toBeVisible();
    expect(
      await region.locator(':scope > .citations a').allTextContents(),
    ).toEqual(
      (data.sourceIds ?? []).map(
        (id) => output.document.data.sources!.find((s) => s.id === id)!.title,
      ),
    );
  }
  expect(await page.locator('.sources > ol > li').allTextContents()).toEqual(
    output.document.data.sources!.map((s) => s.title),
  );
  expect(await page.locator('#introduction > .prose').textContent()).toBe(
    output.document.data.sections[0]!.blocks[0]!.text,
  );
  expect(await page.locator('#build-command code').textContent()).toBe(
    output.document.data.sections[2]!.blocks[2]!.text,
  );
  await expect(page.locator('#reading-note strong')).toHaveText('閱讀方式：');
  expect(await page.locator('#checklist .semloom-list > li').count()).toBe(2);
  await expect(page.locator('#weekly-metrics .semloom-metric')).toHaveCount(3);
  expect(
    await page
      .locator('#weekly-metrics dd > span:first-child')
      .allTextContents(),
  ).toEqual(['2 項', '3 項', '0 項']);
  await expect(page.locator('#release-warning .prose')).toHaveText(
    output.document.data.sections[0]!.blocks[2]!.text as string,
  );
  await expect(page.locator('#next-steps ol > li')).toHaveCount(3);
  expect(
    await page.locator('#milestones .semloom-timeline-time').allTextContents(),
  ).toEqual(['週一（展示值）', '週五（展示值）']);
  const comparison = blocks.find((b) => b.id === 'changes-comparison')!
    .data as ComparisonBlock;
  const region = page.locator('#changes-comparison');
  const values = comparison.items.flatMap((item) =>
    comparison.fields.map((field) =>
      item.attributes[field.key] == null
        ? '未提供'
        : String(item.attributes[field.key]),
    ),
  );
  expect(await region.locator('tbody td').allTextContents()).toEqual(values);
  expect(await region.locator('.comparison-card dd').allTextContents()).toEqual(
    values,
  );
  expect(await region.locator('tbody th').allTextContents()).toEqual(
    comparison.items.map((i) => i.name),
  );
  expect(
    await region.locator('thead th:not(:first-child)').allTextContents(),
  ).toEqual(
    comparison.fields.map((f) => `${f.label}${f.unit ? ` (${f.unit})` : ''}`),
  );
  expect(
    await region.locator('.comparison-card:first-child dt').allTextContents(),
  ).toEqual(
    comparison.fields.map((f) => `${f.label}${f.unit ? ` (${f.unit})` : ''}`),
  );
  await expect(
    page.locator('#project-map .semloom-hierarchy-label'),
  ).toHaveCount(13);
  expect(
    await page
      .locator('a[href^="#"]')
      .evaluateAll(
        (links) =>
          links.filter(
            (a) =>
              !document.getElementById(
                decodeURIComponent(a.getAttribute('href')!.slice(1)),
              ),
          ).length,
      ),
  ).toBe(0);
  expect(
    await page
      .locator('[id]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.id).filter((id, i, all) => all.indexOf(id) !== i),
      ),
  ).toEqual([]);
}

for (const javaScriptEnabled of [true, false]) {
  for (const interactive of [false, true]) {
    test(`reading report preserves complete content, keyboard and print; JS=${javaScriptEnabled}, switching=${interactive}`, async ({
      browser,
    }, info) => {
      const { input, config, catalog } = await setup();
      const output = compile(
        input,
        { ...config, interactive },
        undefined,
        catalog,
      );
      // Optional receipt replays exact installed CLI output without rewriting it.
      const receiptPath = process.env.SEMLOOM_READING_RECEIPT;
      const receipt = receiptPath
        ? JSON.parse(await readFile(receiptPath, 'utf8'))
        : undefined;
      const file = receipt
        ? resolve(receipt.consumer, `reports/reading-${interactive}.html`)
        : resolve(
            directory,
            `${info.project.name}-${javaScriptEnabled}-${interactive}.html`,
          );
      if (!receipt) await writeFile(file, output.html);
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: info.project.use.viewport,
        offline: true,
      });
      const page = await context.newPage();
      const requests: string[] = [],
        errors: string[] = [];
      context.on('request', (r) => {
        if (/^https?:/u.test(r.url())) requests.push(r.url());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(file).href);
      await fidelity(page, output);
      const mobile = info.project.name === 'mobile';
      const nav = page.locator('[data-toc]'),
        toggle = page.locator('[data-nav-toggle]');
      const wide = page.locator('.semloom-comparison-wide'),
        narrow = page.locator('.semloom-comparison-narrow');
      await expect(mobile ? narrow : wide).toBeVisible();
      await expect(mobile ? wide : narrow).toBeHidden();
      await expect(page.getByRole('table')).toHaveCount(mobile ? 0 : 1);
      await page.keyboard.press('Tab');
      await expect(page.locator('.skip-link')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      if (javaScriptEnabled && mobile) {
        await expect(nav).toBeHidden();
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(nav).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(nav.locator('a').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
        await expect(nav).toBeHidden();
        await page.keyboard.press('Space');
      } else {
        await expect(nav).toBeVisible();
        await expect(toggle).toBeHidden();
      }
      const target = nav.locator('a[href="#changes"]');
      await target.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#changes$/u);
      if (javaScriptEnabled)
        await expect(page.locator('#changes')).toBeFocused();
      await page.locator('#changes-comparison .citations a').click();
      await expect(page).toHaveURL(/#semloom-source-illustration$/u);
      if (javaScriptEnabled) {
        const map = page.locator('#project-map .semloom-hierarchy');
        await expect(map).toHaveAttribute('data-mindmap-ready', '');
        await expect(map.locator('g.markmap-node')).toHaveCount(13);
        const fold = map.getByRole('button', {
          name: /^(收合|展開) 研究$/u,
        });
        await fold.focus();
        await page.keyboard.press('Enter');
        await expect(fold).toHaveAttribute('aria-expanded', 'false');
        if (interactive) {
          const select = page.locator('#changes-comparison select');
          const citations = await page
            .locator('#changes-comparison > .citations')
            .innerHTML();
          for (const value of [
            'comparison.cards',
            'comparison.table',
            'comparison.responsive',
          ]) {
            await select.focus();
            await select.selectOption(value);
            await expect(select).toBeFocused();
            await expect(page.locator('#changes-comparison')).toHaveAttribute(
              'data-variant',
              value,
            );
          }
          expect(
            await page.locator('#changes-comparison > .citations').innerHTML(),
          ).toBe(citations);
          await fidelity(page, output);
        }
      } else {
        await expect(page.locator('[data-mindmap-fallback]')).toBeVisible();
        await expect(page.locator('svg.markmap')).toHaveCount(0);
        await expect(page.locator('[data-switcher]')).toBeHidden();
      }
      await page.emulateMedia({ media: 'print' });
      await expect(nav).toBeHidden();
      await expect(wide).toBeVisible();
      await expect(narrow).toBeHidden();
      await expect(page.locator('[data-mindmap-fallback]')).toBeVisible();
      await expect(
        page.locator('#project-map .semloom-hierarchy-label').last(),
      ).toBeVisible();
      await expect(page.locator('svg.markmap')).toBeHidden();
      await expect(page.locator('html')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );
      await expect(page.locator('#release-warning aside')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );
      await expect(
        page.locator('#release-warning .semloom-insight-label'),
      ).toHaveCSS('color', 'rgb(0, 0, 0)');
      await expect(page.locator('td').first()).toHaveCSS('min-width', '0px');
      await fidelity(page, output);
      if (!receipt && !mobile && javaScriptEnabled && !interactive) {
        await page.pdf({
          path: resolve(directory, 'report-print.pdf'),
          format: 'A4',
        });
        await page.screenshot({
          path: resolve(directory, 'print.png'),
          fullPage: true,
        });
      }
      await page.emulateMedia({ media: 'screen' });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (!receipt && javaScriptEnabled && !interactive) {
        await page.goto(pathToFileURL(file).href);
        await expect(
          page.locator('#project-map .semloom-hierarchy'),
        ).toHaveAttribute('data-mindmap-ready', '');
        await page.screenshot({
          path: resolve(directory, `${info.project.name}.png`),
          fullPage: true,
        });
        await page.locator('#changes-comparison').screenshot({
          path: resolve(directory, `${info.project.name}-comparison.png`),
        });
      }
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      await context.close();
    });
  }
}

test('reading presentation crosses navigation/comparison breakpoints and composes other Themes and Layouts', async ({
  page,
}, info) => {
  const { input, config, catalog } = await setup();
  const cases = [
    ...themeNames.map((theme) => ({ theme, layout: 'example.paper-sidebar' })),
    ...['document', 'sidebar', 'example.paper-sidebar'].map((layout) => ({
      theme: 'example.reading',
      layout,
    })),
  ];
  for (const choice of cases) {
    const output = compile(input, { ...config, ...choice }, undefined, catalog);
    const file = resolve(
      directory,
      `compat-${info.project.name}-${choice.theme}-${choice.layout}.html`,
    );
    await writeFile(file, output.html);
    await page.goto(pathToFileURL(file).href);
    await fidelity(page, output);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (
      choice.layout === 'example.paper-sidebar' &&
      info.project.name === 'desktop'
    ) {
      const nav = (await page.locator('[data-toc]').boundingBox())!;
      const main = (await page.locator('main').boundingBox())!;
      expect(nav.x + nav.width).toBeLessThan(main.x);
      const sheet = await page.locator('.page').evaluate((el) => ({
        bg: getComputedStyle(el, '::before').backgroundColor,
        surface: getComputedStyle(el).getPropertyValue('--surface').trim(),
      }));
      expect(sheet.bg).not.toBe('rgba(0, 0, 0, 0)');
    }
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.semloom-comparison-wide')).toBeVisible();
    await expect(page.locator('.semloom-comparison-narrow')).toBeHidden();
    await expect(page.locator('[data-mindmap-fallback]')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  }
  for (const width of [1051, 1050, 801, 800, 761, 760, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const nav = page.locator('[data-toc]'),
      toggle = page.locator('[data-nav-toggle]');
    await expect(
      width <= 760
        ? page.locator('.semloom-comparison-narrow')
        : page.locator('.semloom-comparison-wide'),
    ).toBeVisible();
    await expect(
      width <= 760
        ? page.locator('.semloom-comparison-wide')
        : page.locator('.semloom-comparison-narrow'),
    ).toBeHidden();
    if (width > 800) {
      await expect(nav).toBeVisible();
      await nav.locator('a').first().focus();
    } else {
      await expect(toggle).toBeVisible();
      await expect(nav).toBeHidden();
      if (width === 800) await expect(toggle).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
