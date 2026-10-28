import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  loadRegistry,
  themeNames,
  type ThemeName,
} from '../../dist/index.js';

const reports = resolve('reports/e2e');
const id = '中文"深層&章節';

test('complete demos and local plugin read across the Theme/Layout matrix', async ({
  page,
}, testInfo) => {
  const registry = await loadRegistry([
    resolve('examples/comparison-plugin/index.mjs'),
  ]);
  await mkdir(reports, { recursive: true });
  for (const file of ['comparison', 'pr-daily', 'comparison-plugin/report']) {
    const input = JSON.parse(await readFile(`examples/${file}.json`, 'utf8'));
    for (const theme of themeNames) {
      for (const layout of ['document', 'sidebar'] as const) {
        const output = compile(
          input,
          {
            theme,
            layout,
            ...(file.includes('plugin')
              ? { overrides: { tools: 'example.comparison.rows' } }
              : {}),
          },
          registry,
        );
        const name = `${testInfo.project.name}-${file.replace('/', '-')}-${theme}-${layout}`;
        const path = resolve(reports, `${name}.html`);
        await writeFile(path, output.html);
        await page.goto(pathToFileURL(path).href);
        await expect(page.locator('html')).toHaveCSS(
          'color-scheme',
          theme === 'midnight' ? 'dark' : 'light',
        );
        await expect(page.locator('h1')).toHaveText(input.title);
        await expect(page.locator('[data-variant]')).toHaveCount(
          output.plan.blocks.length,
        );
        for (const planned of output.plan.blocks) {
          expect(
            await page
              .locator('[data-variant]')
              .evaluateAll(
                (nodes, block) =>
                  nodes.some(
                    (node) =>
                      node.id === block.id &&
                      node.getAttribute('data-variant') === block.selected,
                  ),
                planned,
              ),
          ).toBe(true);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.keyboard.press('Tab');
        await expect(
          page.getByRole('link', { name: '跳至內容' }),
        ).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        for (const region of await page.locator('.table-scroll').all()) {
          await region.focus();
          await expect(region).toBeFocused();
          expect(
            await region.evaluate((element) => {
              element.scrollLeft = element.scrollWidth - element.clientWidth;
              return (
                element
                  .querySelector('thead th:last-child')!
                  .getBoundingClientRect().right <=
                element.getBoundingClientRect().right + 1
              );
            }),
          ).toBe(true);
          await region.evaluate((element) => {
            element.scrollLeft = 0;
            element.blur();
          });
        }
        if (file === 'comparison' && theme !== 'minimal') {
          await page.locator('main').evaluate((element) => element.blur());
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: resolve(reports, `${name}.png`),
            fullPage: true,
          });
        }
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
        await expect(page.locator('html')).toHaveCSS(
          'background-color',
          'rgb(255, 255, 255)',
        );
        for (const surface of await page
          .locator(
            '.comparison-card,.table-scroll,.example-note,.example-comparison',
          )
          .all())
          await expect(surface).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
          );
        if (await page.locator('thead th').count())
          await expect(page.locator('thead th').first()).toHaveCSS(
            'background-color',
            'rgb(238, 238, 238)',
          );
        await expect(page.getByRole('navigation')).toBeHidden();
        await expect(page.locator('.sources')).toBeVisible();
        expect(await page.locator('main').innerText()).toContain(
          input.sections[0].title,
        );
        await page.emulateMedia({ media: 'screen' });
      }
    }
  }
});

async function report(
  theme: ThemeName,
  layout: 'document' | 'sidebar',
  name: string,
) {
  const source = JSON.parse(await readFile('examples/pr-daily.json', 'utf8'));
  let section = source.sections[0];
  for (let depth = 1; depth < 8; depth++) {
    section.sections = [
      {
        id: depth === 7 ? id : `depth-${depth}`,
        title: '同名中文章節',
        blocks: [
          {
            kind: 'prose',
            text: `層級 ${depth}\n` + '逐項檢查完整內容。\n'.repeat(15),
          },
        ],
      },
    ];
    section = section.sections[0];
  }
  const file = resolve(reports, `${name}-${theme}-${layout}.html`);
  await mkdir(reports, { recursive: true });
  await writeFile(file, compile(source, { theme, layout }).html);
  return pathToFileURL(file).href;
}

test('themes × layouts: deep/CJK anchors, scroll spy, keyboard disclosure, offline/no-JS and print', async ({
  browser,
}, testInfo) => {
  for (const theme of themeNames) {
    for (const layout of ['document', 'sidebar'] as const) {
      const url = await report(theme, layout, testInfo.project.name);
      for (const javaScriptEnabled of [true, false]) {
        const context = await browser.newContext({
          viewport: testInfo.project.use.viewport,
          javaScriptEnabled,
        });
        const page = await context.newPage();
        const requests: string[] = [];
        const errors: string[] = [];
        page.on('request', (request) => {
          if (/^https?:/u.test(request.url())) requests.push(request.url());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(url);
        const nav = page.locator('[data-toc]');
        const toggle = page.locator('[data-nav-toggle]');
        const mobileSidebar =
          layout === 'sidebar' && testInfo.project.name === 'mobile';
        if (javaScriptEnabled && mobileSidebar) {
          await expect(nav).toBeHidden();
          await expect(toggle).toHaveAccessibleName('開啟目錄');
          await toggle.focus();
          await page.keyboard.press('Enter');
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await page.keyboard.press('Tab');
          await expect(nav.locator('a').first()).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(toggle).toBeFocused();
          await expect(nav).toBeHidden();
          await toggle.click();
        } else {
          await expect(nav).toBeVisible();
          await expect(toggle).toBeHidden();
        }
        // Every generated TOC link points to an existing section, including eight levels.
        const ids = await nav
          .locator('a')
          .evaluateAll((links) =>
            links.map((link) => decodeURIComponent(link.hash.slice(1))),
          );
        for (const target of ids)
          expect(
            await page
              .locator('[id]')
              .evaluateAll(
                (nodes, value) => nodes.some((node) => node.id === value),
                target,
              ),
          ).toBe(true);
        await nav
          .locator('a')
          .filter({ hasText: '同名中文章節' })
          .last()
          .click();
        await expect(page).toHaveURL(
          new RegExp(
            `${encodeURIComponent(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'u',
          ),
        );
        if (javaScriptEnabled) {
          expect(await page.evaluate(() => document.activeElement?.id)).toBe(
            id,
          );
          await expect(
            nav.locator('[aria-current="location"]'),
          ).toHaveAttribute('data-section', id);
          if (mobileSidebar) await expect(nav).toBeHidden();
          await page.evaluate(() => window.scrollTo(0, 0));
          await expect(
            nav.locator('[aria-current="location"]'),
          ).toHaveAttribute('data-section', 'summary');
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.emulateMedia({ media: 'print' });
        await expect(nav).toBeHidden();
        await expect(toggle).toBeHidden();
        await expect(page.locator('.sources')).toBeVisible();
        await expect(page.locator('#pull-requests')).toContainText(
          '本區塊來源',
        );
        await page.emulateMedia({ media: 'screen' });
        await context.setOffline(true);
        await page.reload();
        await expect(page.locator('h1')).toContainText('PR 日報');
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
        await context.close();
      }
    }
  }
});

test('sidebar enhancement failure preserves navigation; resizing never hides focused links', async ({
  browser,
}, testInfo) => {
  const url = await report(
    'editorial',
    'sidebar',
    `${testInfo.project.name}-fallback`,
  );
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  await context.addInitScript(() => {
    window.matchMedia = () => {
      throw new Error('unavailable');
    };
  });
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.locator('[data-nav-toggle]')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-nav-ready');
  await page.getByRole('navigation').locator('a').last().click();
  await expect(page.locator('h1')).toBeAttached();
  await context.close();
  const active = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const reader = await active.newPage();
  await reader.goto(url);
  await reader.getByRole('navigation').locator('a').first().focus();
  await reader.setViewportSize({ width: 375, height: 812 });
  await expect(reader.locator('[data-nav-toggle]')).toBeFocused();
  await expect(reader.getByRole('navigation')).toBeHidden();
  await reader.setViewportSize({ width: 1280, height: 900 });
  await expect(reader.getByRole('navigation')).toBeVisible();
  await expect(reader.locator('[data-nav-toggle]')).toBeHidden();
  await expect(
    reader.getByRole('navigation').locator('a').first(),
  ).toBeFocused();
  await active.close();
});
