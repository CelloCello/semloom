import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compile,
  loadPresentation,
  loadRegistry,
  parseConfig,
  themeNames,
} from '../../dist/index.js';
import { localizationDocument } from '../fixtures/localization.mjs';

const folder = resolve('reports/locales');

function textLanguages(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT),
    result = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    result.push({
      text: node.textContent!,
      locale: node.parentElement?.closest('[lang]')?.getAttribute('lang'),
    });
  return result;
}

test('metric comparison prefixes and authored units keep separate languages, including fallback and print', async ({
  page,
}, info) => {
  await mkdir(folder, { recursive: true });
  for (const locale of ['fr-FR', 'en-US', 'zh-TW']) {
    const input = {
      schemaVersion: '1.0',
      locale,
      title: 'Rapport original',
      sections: [
        {
          title: 'Mesures',
          blocks: [
            {
              id: 'metric-owner',
              kind: 'metrics',
              items: [
                { label: 'Temps', value: 2, unit: 'jours', comparisonValue: 1 },
                {
                  label: 'Durée',
                  value: 4,
                  unit: 'heures',
                  comparisonValue: 3,
                  comparisonLabel: 'Référence',
                },
              ],
            },
          ],
        },
      ],
    };
    const original = structuredClone(input),
      output = compile(input);
    expect(output.document.data).toEqual(original);
    const file = resolve(
      folder,
      `metric-owner-${locale}-${info.project.name}.html`,
    );
    await writeFile(file, output.html);
    await page.goto(pathToFileURL(file).href);
    for (const media of ['screen', 'print'] as const) {
      await page.emulateMedia({ media });
      const rows = page.locator('#metric-owner .semloom-comparison');
      const prefix = locale === 'en-US' ? 'Comparison value' : '比較值';
      await expect(rows.first()).toHaveText(
        `${prefix}${locale === 'en-US' ? ': ' : '：'}1 jours`,
      );
      const runs = await rows.first().evaluate(textLanguages);
      expect(
        runs
          .filter((run) => run.text.includes('jours'))
          .map((run) => run.locale),
      ).toEqual([locale]);
      expect(
        runs
          .filter((run) => run.text.includes(prefix))
          .map((run) => run.locale),
      ).toEqual([locale === 'en-US' ? 'en' : 'zh-TW']);
      await expect(rows.nth(1)).toHaveText(
        `Référence${locale === 'en-US' ? ': ' : '：'}3 heures`,
      );
      const authored = await rows.nth(1).evaluate(textLanguages);
      expect(
        authored
          .filter((run) => /Référence|heures/u.test(run.text))
          .every((run) => run.locale === locale),
      ).toBe(true);
    }
  }
});

async function presentation() {
  await mkdir(folder, { recursive: true });
  const config = parseConfig(
    JSON.parse(await readFile('examples/reading-presentation.json', 'utf8')),
  );
  const catalog = await loadPresentation(config, resolve('examples'));
  return { config, catalog };
}
const labels = (english: boolean) =>
  english
    ? {
        locale: 'en',
        toc: 'Contents',
        title: 'Contents and sources',
        sources: 'Sources',
        dataSources: 'Data sources',
        skip: 'Skip to content',
        display: 'Display as',
        missing: 'Not provided',
        item: 'Item',
        warning: 'Warning',
        comparison: 'Comparison value: 1 項',
        code: 'Code: js 原文',
        collapse: 'Collapse',
        expand: 'Expand',
        variants: ['Table', 'Cards', 'Responsive'],
      }
    : {
        locale: 'zh-TW',
        toc: '目錄',
        title: '目錄與資料來源',
        sources: '來源',
        dataSources: '資料來源',
        skip: '跳至內容',
        display: '顯示方式',
        missing: '未提供',
        item: '對象',
        warning: '注意',
        comparison: '比較值：1 項',
        code: '程式碼：js 原文',
        collapse: '收合',
        expand: '展開',
        variants: ['表格', '卡片', '自適應'],
      };

for (const locale of ['zh-TW', 'en-US', 'EN-gb', 'fr-FR', 'zh-Hans']) {
  for (const javaScriptEnabled of [true, false]) {
    test(`report UI locale=${locale}, JS=${javaScriptEnabled}: literal content, fallback, switching, a11y and print`, async ({
      browser,
    }, info) => {
      const { config, catalog } = await presentation();
      const input = localizationDocument(locale),
        original = structuredClone(input);
      const english = locale.toLowerCase().split('-')[0] === 'en',
        ui = labels(english);
      const context = await browser.newContext({
        javaScriptEnabled,
        offline: true,
        viewport: info.project.use.viewport,
      });
      const page = await context.newPage();
      const errors: string[] = [],
        requests: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      context.on('request', (r) => {
        if (/^https?:/u.test(r.url())) requests.push(r.url());
      });
      for (const interactive of [false, true]) {
        const output = compile(
          input,
          { ...config, interactive },
          undefined,
          catalog,
        );
        expect(output.document.data).toEqual(original);
        expect(output.plan.context.locale).toBe(locale);
        const file = resolve(
          folder,
          `${info.project.name}-${locale}-${javaScriptEnabled}-${interactive}.html`,
        );
        await writeFile(file, output.html);
        await page.goto(pathToFileURL(file).href);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute(
          'data-ui-locale',
          ui.locale,
        );
        await expect(page.locator('h1')).toHaveText(input.title);
        expect(await page.locator('#introduction > .prose').textContent()).toBe(
          input.sections[0].blocks[0].text,
        );
        expect(await page.locator('#build-command code').textContent()).toBe(
          input.sections[2].blocks[2].text,
        );
        await expect(page.locator('#build-command code')).toHaveAttribute(
          'lang',
          locale,
        );
        await expect(page.locator('#build-command pre')).toHaveAccessibleName(
          ui.code,
        );
        await expect(page.locator('#build-command pre')).toHaveAttribute(
          'lang',
          ui.locale,
        );
        await expect(page.locator('.skip-link')).toHaveText(ui.skip);
        await expect(page.locator('#semloom-sources')).toHaveText(ui.sources);
        await expect(
          page.locator('#release-warning .semloom-insight-label'),
        ).toHaveText(ui.warning);
        await expect(
          page.locator('#release-warning .semloom-insight-label'),
        ).toHaveAttribute('lang', ui.locale);
        const comparisons = page.locator('#weekly-metrics .semloom-comparison');
        await expect(comparisons.first()).toHaveText(ui.comparison);
        await expect(comparisons.nth(1)).toHaveText(
          `作者 label${english ? ': ' : '：'}-1 項`,
        );
        await expect(comparisons.nth(1)).toHaveAttribute('lang', locale);
        expect(
          await page.locator('.sources > ol > li').allTextContents(),
        ).toEqual(input.sources.map((s: { title: string }) => s.title));
        expect(
          await page
            .locator('#milestones .semloom-timeline-time')
            .first()
            .textContent(),
        ).toBe(input.sections[2].blocks[3].items[0].time);
        await expect(page.locator('#reading-note strong')).toHaveText(
          '閱讀方式：',
        );
        const block = page.locator('#changes-comparison');
        const expected = Array.from({ length: 2 }, () => [
          '0',
          'false',
          '',
          ui.missing,
          ui.missing,
          ui.missing,
          '未提供',
        ]).flat();
        expect(await block.locator('tbody td').allTextContents()).toEqual(
          expected,
        );
        expect(
          await block.locator('.comparison-card dd').allTextContents(),
        ).toEqual(expected);
        await expect(block.locator('thead th').first()).toHaveText(ui.item);
        await expect(block.locator('thead th').first()).toHaveAttribute(
          'lang',
          ui.locale,
        );
        await expect(block.locator('tbody td').first()).toHaveAttribute(
          'lang',
          locale,
        );
        await expect(block.locator('tbody td').nth(3)).toHaveAttribute(
          'lang',
          ui.locale,
        );
        const nav = page.getByRole('navigation', {
          name: ui.toc,
          exact: true,
          includeHidden: true,
        });
        await expect(nav).toHaveAttribute('lang', ui.locale);
        expect(
          await nav
            .locator('[data-section]')
            .first()
            .evaluate((el) => el.closest('[lang]')?.getAttribute('lang')),
        ).toBe(locale);
        const mobile = info.project.name === 'mobile';
        if (javaScriptEnabled && mobile) {
          const toggle = page.getByRole('button', {
            name: ui.title,
            exact: true,
          });
          await expect(nav).toBeHidden();
          await toggle.focus();
          await page.keyboard.press('Enter');
          await expect(nav).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(toggle).toBeFocused();
          await page.keyboard.press('Space');
        } else await expect(nav).toBeVisible();
        const source = nav.getByRole('link', {
          name: ui.dataSources,
          exact: true,
        });
        await source.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#semloom-sources$/u);
        if (javaScriptEnabled)
          await expect(page.locator('#semloom-sources')).toBeFocused();
        if (javaScriptEnabled && interactive) {
          const select = block.getByRole('combobox', { name: ui.display });
          expect(await select.locator('option').allTextContents()).toEqual(
            ui.variants,
          );
          for (const variant of [
            'comparison.table',
            'comparison.cards',
            'comparison.responsive',
          ]) {
            await select.selectOption(variant);
            await expect(block).toHaveAttribute('data-variant', variant);
            expect(
              await block
                .locator('tbody td, .comparison-card dd')
                .allTextContents(),
            ).toEqual(
              variant === 'comparison.responsive'
                ? [...expected, ...expected]
                : expected,
            );
          }
          expect(await block.locator('.citations a').allTextContents()).toEqual(
            [input.sources[0].title],
          );
        }
        const map = page.locator('#project-map .semloom-hierarchy');
        if (javaScriptEnabled) {
          await expect(map).toHaveAttribute('data-mindmap-ready', '');
          await expect(map.locator('svg')).toHaveAccessibleName(
            english ? 'Mind map' : '心智圖',
          );
          await expect(map.locator('svg')).toHaveAttribute('lang', ui.locale);
          await expect(map.locator('foreignObject').first()).toHaveAttribute(
            'lang',
            locale,
          );
          const fold = map.getByRole('button', {
            name: new RegExp(`^(${ui.collapse}|${ui.expand}) 研究$`, 'u'),
          });
          await fold.focus();
          await page.keyboard.press('Enter');
          await expect(fold).toHaveAccessibleName(`${ui.expand} 研究`);
        } else {
          await expect(map.locator('[data-mindmap-fallback]')).toBeVisible();
          await expect(map.locator('svg')).toHaveCount(0);
        }
        await page.emulateMedia({ media: 'print' });
        await expect(nav).toBeHidden();
        await expect(page.locator('.semloom-comparison-wide')).toBeVisible();
        await expect(page.locator('.semloom-comparison-narrow')).toBeHidden();
        await expect(map.locator('[data-mindmap-fallback]')).toBeVisible();
        await expect(map.locator('.semloom-hierarchy-label')).toHaveCount(13);
        await expect(block.locator('thead th').first()).toHaveText(ui.item);
        await page.emulateMedia({ media: 'screen' });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (
          process.env.SEMLOOM_LOCALE_SCREENSHOTS === '1' &&
          locale === 'en-US' &&
          javaScriptEnabled &&
          !interactive
        ) {
          await page.goto(pathToFileURL(file).href);
          await expect(map).toHaveAttribute('data-mindmap-ready', '');
          await page.screenshot({
            path: resolve(folder, `${info.project.name}-en.png`),
            fullPage: true,
          });
        }
      }
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(input).toEqual(original);
      await context.close();
    });
  }
}

test('runtime failure, cleanup warning, static placeholder and Plugin labels use the correct ownership and locale', async ({
  page,
}, info) => {
  const { config, catalog } = await presentation();
  const registry = await loadRegistry([
    resolve('tests/fixtures/browser-plugin.mjs'),
  ]);
  for (const locale of ['en-US', 'zh-TW', 'fr-FR']) {
    const english = locale === 'en-US',
      ui = labels(english);
    const output = compile(
      localizationDocument(locale),
      {
        ...config,
        interactive: true,
        overrides: {
          ...config.overrides,
          'changes-comparison': 'fixture.static',
        },
      },
      registry,
      catalog,
    );
    const file = resolve(folder, `errors-${info.project.name}-${locale}.html`);
    await writeFile(file, output.html);
    await page.goto(pathToFileURL(file).href);
    const block = page.locator('#changes-comparison'),
      select = block.getByRole('combobox', { name: ui.display }),
      error = block.locator('[data-switch-error]');
    await expect(select.locator('option:checked')).toHaveText(
      english ? 'Current view' : '目前建置版型',
    );
    await expect(select.locator('option[value="fixture.tracked"]')).toHaveText(
      'fixture.tracked',
    );
    await expect(
      select.locator('option[value="fixture.tracked"]'),
    ).toHaveAttribute('lang', locale);
    const before = await block.locator('[data-view-host]').innerHTML();
    await select.selectOption('fixture.failed');
    await expect(error).toHaveText(
      english
        ? 'Unable to switch views. The original content has been kept. Retry or choose another view.'
        : '無法切換顯示方式，已保留原內容。請重試或選擇其他方式。',
    );
    await expect(error).toHaveAttribute('lang', ui.locale);
    expect(await block.locator('[data-view-host]').innerHTML()).toBe(before);
    await select.selectOption('fixture.dispose-error');
    await select.selectOption('comparison.cards');
    await expect(error).toHaveText(
      english
        ? 'The view changed, but cleanup of the previous view failed.'
        : '顯示方式已切換，但舊版型清理失敗。',
    );
    await expect(select).toBeFocused();
  }
});

test('English UI composes built-in Themes with document and sidebar Layouts', async ({
  page,
}, info) => {
  await mkdir(folder, { recursive: true });
  for (const theme of themeNames)
    for (const layout of ['document', 'sidebar'] as const) {
      const file = resolve(
        folder,
        `${theme}-${layout}-${info.project.name}-en.html`,
      );
      await writeFile(
        file,
        compile(localizationDocument('en-GB'), { theme, layout }).html,
      );
      await page.goto(pathToFileURL(file).href);
      await expect(page.locator('html')).toHaveAttribute(
        'data-ui-locale',
        'en',
      );
      await expect(page.locator('.citations > span').first()).toHaveText(
        'Sources for this block',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('nav')).toBeHidden();
      await expect(page.locator('#semloom-sources')).toHaveText('Sources');
      await page.emulateMedia({ media: 'screen' });
    }
});
