import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  createRegistry,
  loadRegistry,
  themeNames,
} from '../../dist/index.js';

const folder = resolve('reports/interactive');
const payload =
  '</script><img src="https://invalid.example/payload" onerror="globalThis.injected=true"> **plain** `code`';
async function input() {
  const data = JSON.parse(await readFile('examples/comparison.json', 'utf8'));
  const comparison = data.sections[1].blocks[0];
  comparison.subject = payload;
  comparison.fields.push(
    ...['zero', 'false', 'empty', 'null', 'missing', 'constructor'].map(
      (key) => ({ key, label: key, unit: key === 'zero' ? 'ms' : '' }),
    ),
  );
  for (const item of comparison.items)
    Object.assign(item.attributes, {
      zero: 0,
      false: false,
      empty: '',
      null: null,
    });
  comparison.items[0].name = payload;
  data.sources.push({ id: 'plain', title: payload });
  comparison.sourceIds.push('plain');
  return data;
}

test('interactive cards/table preserve server parity, plaintext, citations, keyboard, sidebar, print and offline defaults', async ({
  browser,
}, testInfo) => {
  await mkdir(folder, { recursive: true });
  const source = await input();
  const block = source.sections[1].blocks[0];
  const registry = createRegistry();
  for (const theme of themeNames)
    for (const layout of ['document', 'sidebar'] as const) {
      const file = resolve(
        folder,
        `${testInfo.project.name}-${theme}-${layout}.html`,
      );
      const compiled = compile(
        source,
        { theme, layout, interactive: true },
        registry,
      );
      await writeFile(file, compiled.html);
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
        await page.goto(pathToFileURL(file).href);
        const wrapper = page.locator('#languages');
        const host = wrapper.locator('[data-view-host]');
        const select = wrapper.getByRole('combobox', { includeHidden: true });
        const citations = await wrapper.locator('.citations').innerHTML();
        await expect(wrapper).toHaveAttribute(
          'data-variant',
          'comparison.table',
        );
        if (javaScriptEnabled) {
          await expect(select).toBeVisible();
          await expect(select).toHaveValue('comparison.table');
          expect(
            await select.evaluate(
              (element) => getComputedStyle(element).colorScheme,
            ),
          ).toBe(theme === 'midnight' ? 'dark' : 'light');
          await select.focus();
          await select.press('Shift+Tab');
          await expect(select).not.toBeFocused();
          await page.keyboard.press('Tab');
          await expect(select).toBeFocused();
          if (layout === 'sidebar' && testInfo.project.name === 'mobile')
            await page.locator('[data-nav-toggle]').click();
          const sidebar = await page
            .locator('[data-toc]')
            .getAttribute('data-open');
          for (const variant of [
            'comparison.cards',
            'comparison.table',
            'comparison.responsive',
          ]) {
            await select.selectOption(variant);
            await expect(select).toBeFocused();
            await expect(wrapper).toHaveAttribute('data-variant', variant);
            const expected = registry
              .variant('comparison', variant)
              .render(block, {
                locale: 'zh-TW',
                layout,
                headingLevel: 3,
              }).value;
            expect(await host.innerHTML()).toBe(
              await page.evaluate((markup) => {
                const template = document.createElement('template');
                template.innerHTML = markup;
                return template.innerHTML;
              }, expected),
            );
            expect(await wrapper.locator('.citations').innerHTML()).toBe(
              citations,
            );
            expect(
              await page.locator('[data-toc]').getAttribute('data-open'),
            ).toBe(sidebar);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.emulateMedia({ media: 'print' });
            await expect(select).toBeHidden();
            await expect(host).toContainText(payload);
            await expect(page.locator('.sources')).toContainText(payload);
            await page.emulateMedia({ media: 'screen' });
          }
          await context.setOffline(true);
          await page.reload();
          await select.selectOption('comparison.cards');
          await expect(wrapper).toHaveAttribute(
            'data-variant',
            'comparison.cards',
          );
          await page.reload();
          await expect(wrapper).toHaveAttribute(
            'data-variant',
            'comparison.table',
          );
          await expect(select).toHaveValue('comparison.table');
          if (theme === 'editorial' && layout === 'sidebar') {
            await page.evaluate(() => {
              (document.activeElement as HTMLElement)?.blur();
              window.scrollTo(0, 0);
            });
            await page.screenshot({
              path: resolve(folder, `${testInfo.project.name}-interactive.png`),
              fullPage: true,
            });
          }
        } else {
          await expect(select).toBeHidden();
          await expect(select).toBeDisabled();
          await expect(host).toContainText(payload);
          await wrapper.locator('.citations a').first().click();
          await expect(page).toHaveURL(/#semloom-source-/u);
          await context.setOffline(true);
          await page.reload();
          await expect(host).toBeVisible();
        }
        await expect(page.locator('img,b,strong,code')).toHaveCount(0);
        expect(await page.evaluate(() => 'injected' in globalThis)).toBe(false);
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
        await context.close();
      }
    }
});

test('local adapters load on demand, preserve static-only selection, rollback failed views and dispose repeated resources', async ({
  browser,
}, testInfo) => {
  await mkdir(folder, { recursive: true });
  const source = await input();
  const registry = await loadRegistry([
    resolve('tests/fixtures/browser-plugin.mjs'),
    resolve('examples/comparison-plugin/index.mjs'),
  ]);
  const file = resolve(folder, `${testInfo.project.name}-lifecycle.html`);
  await writeFile(
    file,
    compile(
      source,
      {
        interactive: true,
        overrides: { languages: 'fixture.static' },
        theme: 'editorial',
        layout: 'sidebar',
      },
      registry,
    ).html,
  );
  const context = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/u.test(r.url())) requests.push(r.url());
  });
  await page.goto(pathToFileURL(file).href);
  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { fixtureModuleLoads: number })
          .fixtureModuleLoads,
    ),
  ).toBe(1);
  const wrapper = page.locator('#languages');
  const host = wrapper.locator('[data-view-host]');
  const select = wrapper.getByRole('combobox');
  await expect(wrapper).toHaveAttribute('data-variant', 'fixture.static');
  expect(
    await select
      .locator('option:not([disabled])')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).not.toContain('fixture.static');
  await expect(
    select.locator('option[value="fixture.unsupported"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('style[data-asset="fixture.interactive"]'),
  ).toHaveCount(1);
  await expect(page.locator('style[data-asset="example.base"]')).toHaveCount(1);
  await expect(page.locator('style[data-asset="example.rows"]')).toHaveCount(1);
  const citations = await wrapper.locator('.citations').innerHTML();
  await context.setOffline(true);
  await select.selectOption('example.comparison.rows');
  await expect(host.locator('.example-comparison')).toContainText(payload);
  expect(await wrapper.locator('.citations').innerHTML()).toBe(citations);
  for (let i = 0; i < 10; i++) {
    await select.selectOption('fixture.tracked');
    expect(
      await page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              fixtureViews: { active: number };
            }
          ).fixtureViews.active,
      ),
    ).toBe(1);
    await select.selectOption('comparison.cards');
  }
  const before = await host.innerHTML();
  await select.selectOption('fixture.failed');
  expect(await host.innerHTML()).toBe(before);
  await expect(wrapper).toHaveAttribute('data-variant', 'comparison.cards');
  await expect(select).toHaveValue('comparison.cards');
  await expect(select).toBeFocused();
  await expect(wrapper.getByRole('alert')).toContainText('已保留原內容');
  const state = await page.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        fixtureViews: {
          created: number;
          disposed: number;
          active: number;
          cleanups: number;
          events: number;
        };
      }
    ).fixtureViews;
    window.dispatchEvent(new Event('fixture-event'));
    return state;
  });
  expect(state.active).toBe(0);
  expect(state.created).toBe(11);
  expect(state.disposed).toBe(10);
  expect(state.cleanups).toBe(11);
  expect(state.events).toBe(0);
  await select.selectOption('fixture.dispose-error');
  await select.selectOption('comparison.table');
  await expect(wrapper).toHaveAttribute('data-variant', 'comparison.table');
  await expect(wrapper.getByRole('alert')).toContainText('清理失敗');
  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { fixtureViews: { active: number } })
          .fixtureViews.active,
    ),
  ).toBe(0);
  await select.selectOption('example.comparison.rows');
  await expect(wrapper.getByRole('alert')).toBeHidden();
  expect(await wrapper.locator('.citations').innerHTML()).toBe(citations);
  expect(requests).toEqual([]);
  await select.selectOption('fixture.tracked');
  expect(
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent('pagehide', { persisted: true }),
      );
      return (
        globalThis as typeof globalThis & { fixtureViews: { active: number } }
      ).fixtureViews.active;
    }),
  ).toBe(1);
  expect(
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent('pagehide', { persisted: false }),
      );
      return (
        globalThis as typeof globalThis & { fixtureViews: { active: number } }
      ).fixtureViews.active;
    }),
  ).toBe(0);
  await context.close();
});

test('runtime initialization failure keeps server content and citations with disabled hidden controls', async ({
  browser,
}, testInfo) => {
  await mkdir(folder, { recursive: true });
  const file = resolve(folder, `${testInfo.project.name}-init-failure.html`);
  await writeFile(file, compile(await input(), { interactive: true }).html);
  const context = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  await context.addInitScript(() =>
    Object.defineProperty(window, 'AbortController', { value: undefined }),
  );
  const page = await context.newPage();
  await page.goto(pathToFileURL(file).href);
  const select = page.getByRole('combobox', { includeHidden: true });
  await expect(select).toBeHidden();
  await expect(select).toBeDisabled();
  await expect(page.locator('#languages [data-view-host]')).toContainText(
    payload,
  );
  await page.locator('#languages .citations a').first().click();
  await expect(page).toHaveURL(/#semloom-source-/u);
  await context.close();
});
