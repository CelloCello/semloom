import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from '../../dist/index.js';

test('direct, fixed and Auto samples preserve research facts through initial/edit tasks', async ({
  browser,
}, testInfo) => {
  const folder = resolve('reports/benchmark');
  await mkdir(folder, { recursive: true });
  const records = [];
  const context = await browser.newContext({
    viewport: testInfo.project.use.viewport,
    javaScriptEnabled: false,
  });
  const requests: string[] = [];
  context.on('request', (request) => {
    if (/^https?:/u.test(request.url())) requests.push(request.url());
  });
  const page = await context.newPage();
  for (const edited of [false, true]) {
    const semantic = JSON.parse(
      await readFile(
        `benchmarks/comparison/semantic-${edited ? 'edited' : 'initial'}.json`,
        'utf8',
      ),
    );
    const blocks = semantic.sections.flatMap(
      (s: { blocks: unknown[] }) => s.blocks,
    );
    const comparison = blocks.find(
      (b: { kind: string }) => b.kind === 'comparison',
    );
    const facts = comparison.items.flatMap(
      (item: { name: string; attributes: Record<string, string> }) => [
        item.name,
        ...comparison.fields.map(
          (field: { key: string }) => item.attributes[field.key],
        ),
      ],
    );
    for (const condition of [
      'direct',
      'fixed',
      'auto',
      'cards',
      ...(!edited
        ? [
            'direct-editorial-sidebar',
            'fixed-editorial-sidebar',
            'auto-editorial-sidebar',
          ]
        : []),
    ]) {
      const output =
        condition === 'direct-editorial-sidebar'
          ? await readFile(
              'benchmarks/comparison/direct-editorial-sidebar.html',
              'utf8',
            )
          : condition === 'direct'
            ? await readFile(
                `benchmarks/comparison/direct-${edited ? 'edited' : 'initial'}.html`,
                'utf8',
              )
            : compile(semantic, {
                ...(condition.endsWith('editorial-sidebar')
                  ? { theme: 'editorial', layout: 'sidebar' }
                  : {}),
                ...(!condition.startsWith('auto')
                  ? {
                      overrides: {
                        languages:
                          condition === 'cards'
                            ? 'comparison.cards'
                            : 'comparison.table',
                      },
                    }
                  : {}),
              }).html;
      const name = `${condition}-${edited ? 'edited' : 'initial'}-${testInfo.project.name}`;
      const path = resolve(folder, `${name}.html`);
      await writeFile(path, output);
      await page.goto(pathToFileURL(path).href);
      await expect(page.locator('h1')).toHaveText(semantic.title);
      expect(await page.title()).toBe(semantic.title);
      const body = await page.locator('body').innerText();
      for (const fact of facts) expect(body).toContain(fact);
      for (const source of semantic.sources) {
        await expect(page.locator('.sources')).toContainText(source.title);
        await expect(
          page.locator(`.sources a[href="${source.url}"]`),
        ).toHaveCount(1);
      }
      if (edited)
        expect(body).toContain('下一步：以實際輸入測試驗證錯誤訊息。');
      const dimensions = await page.evaluate(() => ({
        body: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
      expect(requests).toEqual([]);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('nav')).toBeHidden();
      await expect(page.locator('.sources')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      if (!edited)
        await page.screenshot({
          path: resolve(folder, `${name}.png`),
          fullPage: true,
        });
      const navigation = await page.evaluate(() => {
        const entry = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming;
        return {
          domContentLoadedMs: entry.domContentLoadedEventEnd,
          loadMs: entry.loadEventEnd,
        };
      });
      records.push({
        condition,
        edited,
        ...navigation,
        viewport: testInfo.project.name,
        fidelity: 'all comparison values and source links present',
      });
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator('h1')).toHaveText(semantic.title);
      await context.setOffline(false);
    }
  }
  await writeFile(
    resolve(folder, `browser-${testInfo.project.name}.json`),
    JSON.stringify(records, null, 2) + '\n',
  );
  await context.close();
});
