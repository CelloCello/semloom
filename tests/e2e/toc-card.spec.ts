import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, themeNames } from '../../dist/index.js';

test('shared TOC card follows every Theme with one joined mobile disclosure and a permanent desktop sidebar', async ({
  page,
}, info) => {
  const directory = resolve('reports/navigation');
  await mkdir(directory, { recursive: true });
  const input = JSON.parse(
    await readFile('examples/reading-report.json', 'utf8'),
  );
  for (const theme of themeNames) {
    const file = resolve(directory, `${theme}-${info.project.name}.html`);
    await writeFile(file, compile(input, { theme, layout: 'sidebar' }).html);
    await page.goto(pathToFileURL(file).href);
    const nav = page.locator('[data-toc]'),
      toggle = page.locator('[data-nav-toggle]');
    const mobile = info.project.name === 'mobile';
    if (mobile) {
      await expect(nav).toBeHidden();
      await expect(toggle).toHaveAccessibleName('目錄與資料來源');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.screenshot({
        path: resolve(directory, `${theme}-closed.png`),
      });
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(nav).toBeVisible();
      await expect(nav.locator('h2')).toBeHidden();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const button = (await toggle.boundingBox())!,
        links = (await nav.boundingBox())!;
      expect(Math.abs(button.x - links.x)).toBeLessThan(1);
      expect(Math.abs(button.width - links.width)).toBeLessThan(1);
      expect(Math.abs(button.y + button.height - links.y)).toBeLessThan(1);
      const ink = await toggle.evaluate((el) => getComputedStyle(el).color);
      expect(
        await toggle.evaluate(
          (el) => getComputedStyle(el, '::before').borderLeftColor,
        ),
      ).toBe(ink);
      // One capture includes the fixed title, joined borders and complete links.
      await toggle.evaluate((button) => button.blur());
      await page.screenshot({
        path: resolve(directory, `${theme}-open.png`),
        clip: {
          x: button.x,
          y: button.y,
          width: button.width,
          height: button.height + links.height,
        },
      });
    } else {
      await expect(toggle).toBeHidden();
      await expect(nav).toBeVisible();
      await expect(nav.locator('h2')).toHaveText('目錄與資料來源');
      await nav.screenshot({
        path: resolve(directory, `${theme}-desktop.png`),
      });
    }
    expect(
      await nav.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(
      await page.locator('html').evaluate((el) => {
        const probe = document.createElement('div');
        probe.style.background = 'var(--table-hover)';
        el.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      }),
    );
    const source = nav.locator('[data-toc-source]');
    await source.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#semloom-sources')).toBeFocused();
    await expect(source).toHaveAttribute('aria-current', 'location');
    if (mobile) {
      await expect(nav).toBeHidden();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await expect(nav).toBeHidden();
    }
    await page.emulateMedia({ media: 'print' });
    await expect(nav).toBeHidden();
    await expect(toggle).toBeHidden();
    await expect(page.locator('.sources')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  }
});
