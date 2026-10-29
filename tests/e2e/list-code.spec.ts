import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, listLimits, type ListBlock } from '../../dist/index.js';
import { technicalGuide } from '../fixtures/technical-guide.mjs';

const directory = resolve('reports/list-code');

for (const javaScriptEnabled of [true, false]) {
  test(`technical guide initial/edit preserves List/Code content and references; JS=${javaScriptEnabled}`, async ({
    browser,
  }, testInfo) => {
    await mkdir(directory, { recursive: true });
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
    for (const theme of ['minimal', 'midnight']) {
      for (const layout of ['document', 'sidebar']) {
        for (const edited of [false, true]) {
          const input = technicalGuide(edited);
          const file = resolve(
            directory,
            `${testInfo.project.name}-${javaScriptEnabled}-${theme}-${layout}-${edited ? 'edited' : 'initial'}.html`,
          );
          await writeFile(
            file,
            compile(input, { theme, layout, interactive: true }).html,
          );
          await page.goto(pathToFileURL(file).href);
          const root = page.locator('#guide-checklist > ul.semloom-list');
          const child = root.locator(
            ':scope > li:first-child > ol.semloom-list',
          );
          await expect(root).toBeVisible();
          await expect(root.locator('li')).toHaveCount(4);
          expect(
            await root.locator(':scope > li > .prose').allTextContents(),
          ).toEqual(
            input.sections[0].blocks[1].items.map(
              (item: { content: { text: string }[] }) =>
                item.content.map((run) => run.text).join(''),
            ),
          );
          expect(
            await child.locator(':scope > li > .prose').allTextContents(),
          ).toEqual(
            input.sections[0].blocks[1].items[0].children.items.map(
              (item: { content: { text: string }[] }) =>
                item.content.map((run) => run.text).join(''),
            ),
          );
          await expect(root.locator('strong')).toHaveText('整理內容');
          await expect(child.locator('code')).toHaveText(
            'examples/technical-guide.json',
          );
          const code = page.locator('#build-command pre > code');
          expect(await code.textContent()).toBe(
            input.sections[1].blocks[0].text,
          );
          await expect(page.locator('#build-command figcaption')).toHaveText(
            'sh',
          );
          await expect(page.locator('#build-command pre')).toHaveCSS(
            'white-space',
            'pre',
          );
          await expect(page.locator('.citations')).toHaveCount(4);
          expect(
            await page.locator('#review-notes > .prose').textContent(),
          ).toBe(input.sections[2].blocks[0].text);
          await expect(page.locator('#guide-checklist')).toHaveAttribute(
            'data-variant',
            'list.nested',
          );
          await expect(page.locator('#build-command')).toHaveAttribute(
            'data-variant',
            'code.block',
          );
          await expect(page.locator('[data-switcher]')).toHaveCount(0);
          await root.getByRole('link', { name: '生成的 HTML' }).click();
          await expect(page).toHaveURL(/#review$/u);
          await page.locator('#build-command .citations a').click();
          await expect(page).toHaveURL(/#semloom-source-cli-guide$/u);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.emulateMedia({ media: 'print' });
          await expect(root).toBeVisible();
          await expect(code).toBeVisible();
          expect(await code.textContent()).toBe(
            input.sections[1].blocks[0].text,
          );
          await expect(page.locator('#build-command pre')).toHaveCSS(
            'white-space',
            'pre-wrap',
          );
          await expect(page.locator('.sources')).toBeVisible();
          await page.emulateMedia({ media: 'screen' });
          if (javaScriptEnabled && theme === 'midnight' && layout === 'sidebar')
            await page.screenshot({
              path: resolve(
                directory,
                `${testInfo.project.name}-${edited ? 'edited' : 'initial'}.png`,
              ),
              fullPage: true,
            });
        }
      }
    }
    expect(requests).toEqual([]);
    await context.setOffline(true);
    await page.reload();
    expect(await page.locator('#build-command code').textContent()).toBe(
      technicalGuide(true).sections[1].blocks[0].text,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('deep lists wrap safely and literal Code round-trips whitespace, CRLF and injection text', async ({
  browser,
}, testInfo) => {
  await mkdir(directory, { recursive: true });
  const block: ListBlock = {
    kind: 'list',
    id: 'deep-list',
    ordered: true,
    items: [{ content: [{ text: '第 1 層' }] }],
  };
  let group = block.items[0]!;
  for (let depth = 2; depth <= listLimits.depth; depth++) {
    group.children = {
      ordered: depth % 2 === 0,
      items: [
        {
          content: [
            {
              text: `第 ${depth} 層 ` + '長中文'.repeat(20),
              marks: ['code'],
              href: '#literal-code',
            },
          ],
        },
      ],
    };
    group = group.children.items[0]!;
  }
  const text =
    '\n\tconst x = `<>&`;\r\n\r  </code></pre><script>globalThis.injected=true</script>\n' +
    'long-line'.repeat(150) +
    '\n\n';
  const language = '"><img src=x onerror="alert(1)">';
  const input = {
    schemaVersion: '1.0',
    title: 'List and Code edge cases',
    sections: [
      {
        title: 'Content',
        blocks: [block, { kind: 'code', id: 'literal-code', text, language }],
      },
    ],
  };
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  const file = resolve(directory, `${testInfo.project.name}-literal.html`);
  await writeFile(file, compile(input).html);
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('#deep-list li')).toHaveCount(listLimits.depth);
  await expect(page.locator('#deep-list li > .prose').last()).toContainText(
    `第 ${listLimits.depth} 層`,
  );
  const code = page.locator('#literal-code code');
  const region = page.getByRole('region', {
    name: `程式碼：${language}`,
    exact: true,
  });
  expect(await code.textContent()).toBe(text);
  await expect(page.locator('#literal-code figcaption')).toHaveText(language);
  await expect(
    page.locator('img, [onerror], script:not([data-semloom-navigation])'),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await region.focus();
  await page.keyboard.press('ArrowRight');
  await expect(region).toBeFocused();
  await expect(region).toHaveCSS('outline-style', 'solid');
  await expect
    .poll(() => region.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await page.emulateMedia({ media: 'print' });
  await expect(code).toBeVisible();
  expect(await code.textContent()).toBe(text);
  await expect(region).toHaveCSS('overflow-wrap', 'anywhere');
  expect(
    await region.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await context.close();
});
