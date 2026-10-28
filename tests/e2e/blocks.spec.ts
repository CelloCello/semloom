import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, loadRegistry } from '../../dist/index.js';

const directory = resolve('reports/blocks');
test('six semantic kinds and both steps variants preserve content offline, without JS and in print', async ({
  browser,
}, testInfo) => {
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(await readFile('examples/blocks.json', 'utf8'));
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport: testInfo.project.use.viewport,
    });
    const requests: string[] = [];
    context.on('request', (r) => {
      if (/^https?:/u.test(r.url())) requests.push(r.url());
    });
    const page = await context.newPage();
    for (const variant of ['steps.list', 'steps.stepper']) {
      const file = resolve(
        directory,
        `${testInfo.project.name}-${javaScriptEnabled}-${variant}.html`,
      );
      await writeFile(
        file,
        compile(input, { overrides: { sequence: variant } }).html,
      );
      await page.goto(pathToFileURL(file).href);
      expect(await page.locator('[data-kind]').count()).toBe(6);
      expect(await page.locator('#notice .prose').textContent()).toBe(
        input.sections[0].blocks[1].text,
      );
      await expect(
        page.locator('img,script:not([data-semloom-navigation]),b,strong,code'),
      ).toHaveCount(0);
      await expect(page.locator('#numbers')).toContainText('前次提供值：2 件');
      await expect(page.locator('#numbers')).toContainText('比較值：0 件');
      expect(
        await page.locator('#history .semloom-timeline-time').allTextContents(),
      ).toEqual(
        input.sections[2].blocks[0].items.map(
          (item: { time: string }) => item.time,
        ),
      );
      expect(await page.locator('#sequence .semloom-steps > li').count()).toBe(
        3,
      );
      await expect(page.locator('#sequence')).toHaveAttribute(
        'data-variant',
        variant,
      );
      for (const id of ['notice', 'numbers', 'sequence', 'history'])
        await expect(page.locator(`#${id} .citations`)).toContainText(
          '本區塊來源',
        );
      await expect(
        page.locator('style[data-asset="semloom.content"]'),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(requests).toEqual([]);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('nav')).toBeHidden();
      for (const id of [
        'intro',
        'notice',
        'numbers',
        'sequence',
        'choices',
        'history',
      ])
        await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator('.sources')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      if (javaScriptEnabled)
        await page.screenshot({
          path: resolve(directory, `${testInfo.project.name}-${variant}.png`),
          fullPage: true,
        });
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator('#history')).toContainText('補充早先紀錄');
      await context.setOffline(false);
    }
    await context.close();
  }
});

test('local plugin CSS is deduplicated and loaded only for selected variants', async ({
  browser,
}, testInfo) => {
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(
    await readFile('examples/comparison-plugin/report.json', 'utf8'),
  );
  const payload = '</script><img src=x onerror="alert(1)"> **plain text**';
  input.sections[0].blocks[0].text += '\n' + payload;
  const registry = await loadRegistry([
    resolve('examples/comparison-plugin/index.mjs'),
  ]);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  const requests: string[] = [];
  context.on('request', (r) => {
    if (/^https?:/u.test(r.url())) requests.push(r.url());
  });
  const page = await context.newPage();
  for (const variant of [
    'example.comparison.rows',
    'comparison.cards',
    'comparison.table',
  ]) {
    const file = resolve(directory, `${testInfo.project.name}-${variant}.html`);
    await writeFile(
      file,
      compile(input, { overrides: { tools: variant } }, registry).html,
    );
    await page.goto(pathToFileURL(file).href);
    expect(await page.locator('.example-note p').textContent()).toBe(
      input.sections[0].blocks[0].text,
    );
    await expect(page.locator('#tools')).toContainText('方案 A');
    await expect(page.locator('#tools')).toContainText('0');
    await expect(page.locator('.citations')).toHaveCount(2);
    await expect(
      page.locator('script:not([data-semloom-navigation]),img,strong,b'),
    ).toHaveCount(0);
    await expect(page.locator('style[data-asset="example.base"]')).toHaveCount(
      1,
    );
    await expect(page.locator('style[data-asset="example.rows"]')).toHaveCount(
      variant === 'example.comparison.rows' ? 1 : 0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(requests).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#note')).toBeVisible();
    await expect(page.locator('#tools')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    if (variant === 'example.comparison.rows')
      await page.screenshot({
        path: resolve(directory, `${testInfo.project.name}-plugin.png`),
        fullPage: true,
      });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.example-note')).toContainText(
      '同一份 Registry',
    );
    await context.setOffline(false);
  }
  await context.close();
});
