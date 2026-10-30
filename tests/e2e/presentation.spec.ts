import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  parseConfig,
  loadPresentation,
  loadRegistry,
} from '../../dist/index.js';
import { technicalGuide } from '../fixtures/technical-guide.mjs';

const directory = resolve('reports/presentation');
async function setup() {
  const raw = JSON.parse(
    await readFile('examples/presentation/presentation.json', 'utf8'),
  );
  const catalog = await loadPresentation(
    parseConfig(raw),
    resolve('examples/presentation'),
  );
  const registry = await loadRegistry([
    resolve('examples/comparison-plugin/index.mjs'),
  ]);
  const input = technicalGuide();
  for (const path of [
    'examples/blocks.json',
    'examples/comparison-plugin/report.json',
  ]) {
    const extra = JSON.parse(await readFile(path, 'utf8'));
    input.sources.push(...extra.sources);
    input.sections.push(...extra.sections);
  }
  await mkdir(directory, { recursive: true });
  return { raw, catalog, registry, input };
}

for (const javaScriptEnabled of [true, false]) {
  test(`external presentation composes all kinds and Plugin views independently; JS=${javaScriptEnabled}`, async ({
    browser,
  }, testInfo) => {
    const { raw, catalog, registry, input } = await setup();
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport: testInfo.project.use.viewport,
    });
    const page = await context.newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    context.on('request', (request) => {
      if (/^https?:/u.test(request.url())) requests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    for (const theme of [
      'minimal',
      'midnight',
      'example.paper',
      'example.night',
    ]) {
      for (const layout of ['document', 'sidebar', 'example.right-sidebar']) {
        const output = compile(
          input,
          { ...raw, theme, layout, interactive: true },
          registry,
          catalog,
        );
        const file = resolve(
          directory,
          `${testInfo.project.name}-${javaScriptEnabled}-${theme}-${layout}.html`,
        );
        await writeFile(file, output.html);
        await page.goto(pathToFileURL(file).href);
        await expect(page.locator('html')).toHaveCSS(
          'color-scheme',
          ['midnight', 'example.night'].includes(theme) ? 'dark' : 'light',
        );
        const nav = page.locator('[data-toc]');
        const toggle = page.locator('[data-nav-toggle]');
        const mobileNav =
          layout !== 'document' && testInfo.project.name === 'mobile';
        if (mobileNav && javaScriptEnabled) {
          await expect(nav).toBeHidden();
          await toggle.focus();
          await page.keyboard.press('Enter');
          await expect(nav).toBeVisible();
          await page.keyboard.press('Tab');
          await expect(nav.locator('a').first()).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(toggle).toBeFocused();
          await expect(nav).toBeHidden();
          await toggle.click();
        } else await expect(nav).toBeVisible();
        if (!javaScriptEnabled) await expect(toggle).toBeHidden();
        if (layout === 'example.right-sidebar') {
          await expect(page.locator('html')).toHaveAttribute(
            'data-layout',
            'sidebar',
          );
          await expect(page.locator('html')).toHaveAttribute(
            'data-layout-id',
            layout,
          );
          expect(output.plan.context.layout).toBe('sidebar');
          if (testInfo.project.name === 'desktop') {
            const navigation = (await nav.boundingBox())!;
            const main = (await page.locator('main').boundingBox())!;
            expect(navigation.x).toBeGreaterThanOrEqual(main.x + main.width);
          }
        }
        for (const id of [
          'guide-intro',
          'guide-checklist',
          'build-command',
          'notice',
          'numbers',
          'sequence',
          'choices',
          'history',
          'note',
          'tools',
        ])
          await expect(page.locator(`#${id}`)).toBeVisible();
        expect(await page.locator('#build-command code').textContent()).toBe(
          input.sections[1].blocks[0].text,
        );
        await expect(page.locator('#note .example-note')).toHaveCSS(
          'background-color',
          theme === 'example.night'
            ? 'rgb(32, 50, 43)'
            : theme === 'midnight'
              ? 'rgb(32, 44, 61)'
              : 'rgb(255, 255, 255)',
        );
        if (theme === 'example.paper')
          await expect(page.locator('#build-command figcaption')).toHaveCSS(
            'font-weight',
            '600',
          );
        await nav.locator('a[href="#commands"]').click();
        await expect(page).toHaveURL(/#commands$/u);
        await page.locator('#build-command .citations a').click();
        await expect(page).toHaveURL(/#semloom-source-cli-guide$/u);
        if (javaScriptEnabled) {
          await page
            .locator('#tools select')
            .selectOption('example.comparison.rows');
          await expect(
            page.locator('#tools .example-comparison'),
          ).toBeVisible();
          await expect(page.locator('#tools .citations')).toHaveCount(1);
        }
        const payload = JSON.parse(
          (await page.locator('#semloom-interactive-data').textContent())!,
        );
        expect(
          payload.find((block: { id: string }) => block.id === 'tools').context
            .layout,
        ).toBe(layout === 'document' ? 'document' : 'sidebar');
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.emulateMedia({ media: 'print' });
        await expect(nav).toBeHidden();
        await expect(page.locator('html')).toHaveCSS(
          'background-color',
          'rgb(255, 255, 255)',
        );
        await expect(page.locator('.page')).toHaveCSS('display', 'block');
        await expect(page.locator('#build-command code')).toBeVisible();
        await expect(page.locator('.sources')).toBeVisible();
        await page.emulateMedia({ media: 'screen' });
        if (
          javaScriptEnabled &&
          theme === 'example.paper' &&
          layout === 'example.right-sidebar'
        ) {
          await page.goto(pathToFileURL(file).href);
          await page.screenshot({
            path: resolve(
              directory,
              `${testInfo.project.name}-right-sidebar.png`,
            ),
          });
        }
      }
    }
    expect(requests).toEqual([]);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#build-command code')).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('external sidebar keeps navigation on initialization failure and focus across viewport changes', async ({
  browser,
}, testInfo) => {
  const { raw, catalog, registry, input } = await setup();
  const file = resolve(directory, `${testInfo.project.name}-fallback.html`);
  await writeFile(file, compile(input, raw, registry, catalog).html);
  const broken = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  await broken.addInitScript(() => {
    window.matchMedia = () => {
      throw new Error('unavailable');
    };
  });
  const fallback = await broken.newPage();
  await fallback.goto(pathToFileURL(file).href);
  await expect(fallback.locator('[data-toc]')).toBeVisible();
  await expect(fallback.locator('[data-nav-toggle]')).toBeHidden();
  await fallback.locator('[data-toc] a').first().click();
  await expect(fallback).toHaveURL(/#preparation$/u);
  await broken.close();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(file).href);
  await page.locator('[data-toc] a').first().focus();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('[data-nav-toggle]')).toBeFocused();
  await expect(page.locator('[data-toc]')).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('[data-toc] a').first()).toBeFocused();
  await expect(page.locator('[data-toc]')).toBeVisible();
  await context.close();
});
