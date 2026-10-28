import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from '../../dist/index.js';

const reports = resolve('reports/e2e');
test('standalone variants preserve content, citations, TOC, print, security and mobile layout', async ({
  browser,
}, testInfo) => {
  await mkdir(reports, { recursive: true });
  const source = JSON.parse(await readFile('examples/comparison.json', 'utf8'));
  const payload =
    '</script><img src="https://invalid.example/a" onerror="globalThis.injected=true"> **bold** `code`';
  source.sections[0].blocks[0].text += '\n' + payload;
  source.sources.push({ id: 'plain-source', title: payload });
  source.sections[0].blocks[0].sourceIds.push('plain-source');
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport,
      javaScriptEnabled,
    });
    const outgoing: string[] = [];
    context.on('request', (request) => {
      if (/^https?:/u.test(request.url())) outgoing.push(request.url());
    });
    const page = await context.newPage();
    for (const variant of ['comparison.cards', 'comparison.table']) {
      const output = compile(source, {
        overrides: { languages: variant },
      }).html;
      const path = resolve(
        reports,
        `${testInfo.project.name}-${javaScriptEnabled}-${variant}.html`,
      );
      await writeFile(path, output);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path).href);
      await expect(page.locator('h1')).toHaveText(source.title);
      await expect(page.locator('.prose').first()).toContainText(payload);
      expect(await page.locator('.prose').first().textContent()).toBe(
        source.sections[0].blocks[0].text,
      );
      await expect(
        page.locator('script:not([data-semloom-navigation]),img,b,strong,code'),
      ).toHaveCount(0);
      await expect(page.locator('#languages')).toHaveAttribute(
        'data-variant',
        variant,
      );
      await expect(page.locator('#languages')).toContainText(
        'JSON Type Definition',
      );
      await expect(page.locator('#languages')).toContainText('本區塊來源');
      await expect(page.locator('.sources')).toContainText(payload);
      await expect(page.locator('.sources a').first()).toHaveAttribute(
        'href',
        'https://ajv.js.org/guide/schema-language.html',
      );
      await page
        .getByRole('navigation', { name: '目錄' })
        .getByRole('link', { name: '能力比較', exact: true })
        .click();
      await expect(page).toHaveURL(/#comparison$/u);
      await page.locator('#languages .citations a').click();
      await expect(page).toHaveURL(/#semloom-source-ajv-languages$/u);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
      if (variant === 'comparison.table') {
        await expect(
          page.getByRole('region', { name: '資料形狀與驗證能力' }),
        ).toBeVisible();
        await expect(page.locator('thead th')).toHaveCount(5);
        const cells = await page.locator('tbody td').allTextContents();
        expect(cells).toEqual(
          source.sections[1].blocks[0].items.flatMap(
            (item: { attributes: Record<string, string> }) =>
              source.sections[1].blocks[0].fields.map(
                (field: { key: string }) => item.attributes[field.key],
              ),
          ),
        );
      } else {
        expect(
          await page.locator('.comparison-card dd').allTextContents(),
        ).toEqual(
          source.sections[1].blocks[0].items.flatMap(
            (item: { attributes: Record<string, string> }) =>
              source.sections[1].blocks[0].fields.map(
                (field: { key: string }) => item.attributes[field.key],
              ),
          ),
        );
      }
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('navigation')).toBeHidden();
      await expect(page.locator('#languages')).toBeVisible();
      await expect(page.locator('.sources')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      if (javaScriptEnabled) {
        await page.goto(pathToFileURL(path).href);
        await page.screenshot({
          path: resolve(reports, `${testInfo.project.name}-${variant}.png`),
          fullPage: true,
        });
      }
      // First prove there were no requests with networking available, then block networking.
      expect(outgoing).toEqual([]);
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator('#languages')).toContainText(
        'JSON Type Definition',
      );
      await context.setOffline(false);
      expect(errors).toEqual([]);
    }
    await context.close();
  }
});
