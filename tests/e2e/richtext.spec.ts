import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  loadRegistry,
  themeNames,
  layoutNames,
  type RichTextBlock,
} from '../../dist/index.js';

const directory = resolve('reports/richtext');

test('richtext keeps exact text, marks, safe links and citations across Themes, Layouts, no-JS and print', async ({
  browser,
}, testInfo) => {
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(await readFile('examples/richtext.json', 'utf8'));
  const rich = input.sections[0].blocks[0] as RichTextBlock;
  const payload =
    '</p></script><img src="https://invalid.example/a" onerror="globalThis.injected=true"> **literal** &';
  rich.content.push(
    { text: '\n  空白\t與特殊字元：' },
    {
      text: payload,
      marks: ['strong', 'emphasis', 'code'],
      href: 'https://example.com/?q="<>&',
    },
    { text: '\n' + 'long中文'.repeat(100), marks: ['code'] },
    { text: ' 來源', href: '#semloom-source-semloom' },
  );
  input.sections[1].blocks.push({
    id: 'plugin-literal',
    kind: 'example.note',
    text: payload,
  });
  const registry = await loadRegistry([
    resolve('examples/comparison-plugin/index.mjs'),
  ]);
  const expectedText = rich.content.map((run) => run.text).join('');
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport,
      javaScriptEnabled,
    });
    const requests: string[] = [];
    context.on('request', (request) => {
      if (/^https?:/u.test(request.url())) requests.push(request.url());
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const theme of themeNames) {
      for (const layout of layoutNames) {
        const file = resolve(
          directory,
          `${testInfo.project.name}-${javaScriptEnabled}-${theme}-${layout}.html`,
        );
        await writeFile(file, compile(input, { theme, layout }, registry).html);
        await page.goto(pathToFileURL(file).href);
        const paragraph = page.locator('#rich-content > .semloom-richtext');
        expect(await paragraph.textContent()).toBe(expectedText);
        await expect(paragraph.locator('strong').first()).toHaveText(
          '結構化片段',
        );
        await expect(paragraph.locator('em > code').first()).toHaveText(
          'compile()',
        );
        await expect(
          paragraph.locator('a[href="#details"] > strong'),
        ).toHaveText('實作細節');
        await expect(paragraph.locator('strong > em > code')).toHaveText(
          payload,
        );
        await expect(paragraph.locator('a').nth(2)).toHaveAttribute(
          'href',
          'https://example.com/?q="<>&',
        );
        expect(
          await page.locator('#plain-content > .prose').textContent(),
        ).toBe(input.sections[1].blocks[0].text);
        expect(
          await page.locator('#plugin-literal .example-note p').textContent(),
        ).toBe(payload);
        await expect(
          page.locator(
            '#plain-content strong, #plain-content code, #plugin-literal strong, #plugin-literal code, img, [onerror]',
          ),
        ).toHaveCount(0);
        await expect(
          page.locator('script:not([data-semloom-navigation])'),
        ).toHaveCount(0);
        await expect(page.locator('#rich-content > .citations')).toHaveCount(1);
        await expect(
          page.locator('#rich-content > .citations a'),
        ).toHaveAttribute('href', '#semloom-source-semloom');
        await expect(paragraph.locator('code').first()).toHaveCSS(
          'font-family',
          /monospace/,
        );
        await expect(paragraph.locator('em').first()).toHaveCSS(
          'font-style',
          'italic',
        );
        await expect(paragraph.locator('strong').first()).toHaveCSS(
          'font-weight',
          '700',
        );
        const forward = paragraph.getByRole('link', { name: '實作細節' });
        await forward.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(forward).toBeFocused();
        await expect(forward).toHaveCSS('outline-style', 'solid');
        await forward.click();
        await expect(page).toHaveURL(/#details$/u);
        await paragraph
          .getByRole('link', { name: '來源', exact: true })
          .click();
        await expect(page).toHaveURL(/#semloom-source-semloom$/u);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.emulateMedia({ media: 'print' });
        await expect(paragraph).toBeVisible();
        expect(await paragraph.textContent()).toBe(expectedText);
        await expect(page.locator('#rich-content > .citations')).toBeVisible();
        await expect(page.locator('.sources')).toBeVisible();
        await page.emulateMedia({ media: 'screen' });
        if (
          javaScriptEnabled &&
          ((theme === 'minimal' && layout === 'document') ||
            (theme === 'midnight' && layout === 'sidebar'))
        )
          await page.screenshot({
            path: resolve(
              directory,
              `${testInfo.project.name}-${theme}-${layout}.png`,
            ),
            fullPage: true,
          });
      }
    }
    expect(requests).toEqual([]);
    await context.setOffline(true);
    await page.reload();
    expect(await page.locator('.semloom-richtext').textContent()).toBe(
      expectedText,
    );
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('comparison switching leaves static richtext and its references intact', async ({
  page,
}, testInfo) => {
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(await readFile('examples/comparison.json', 'utf8'));
  input.sections[0].blocks.unshift({
    kind: 'richtext',
    id: 'inline-summary',
    content: [{ text: '比較', marks: ['strong'], href: '#languages' }],
    sourceIds: [input.sources[0].id],
  });
  const file = resolve(directory, `${testInfo.project.name}-interactive.html`);
  await writeFile(file, compile(input, { interactive: true }).html);
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('#inline-summary select')).toHaveCount(0);
  const before = await page.locator('#inline-summary').innerHTML();
  await page.locator('#languages select').selectOption('comparison.cards');
  await expect(
    page.locator('#languages .comparison-card').first(),
  ).toBeVisible();
  expect(await page.locator('#inline-summary').innerHTML()).toBe(before);
  await page.locator('#inline-summary .semloom-richtext a').click();
  await expect(page).toHaveURL(/#languages$/u);
});
