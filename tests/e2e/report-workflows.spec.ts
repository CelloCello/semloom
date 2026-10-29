import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, loadPresentation, parseConfig } from '../../dist/index.js';
import { reportWorkflows } from '../fixtures/report-workflows.mjs';
import { workflowFidelity } from './workflow-fidelity.js';

// Run the same fidelity checks against the exact installed CLI artifacts.
const receiptFile = process.env.SEMLOOM_WORKFLOW_RECEIPT;
for (const js of [true, false]) {
  test(`integrated report workflows: initial/edit, presentation, navigation, switching and print; JS=${js}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const receipt = receiptFile
      ? JSON.parse(await readFile(receiptFile, 'utf8'))
      : undefined;
    const scenarios = receipt
      ? reportWorkflows(resolve(receipt.consumer, 'examples/report-workflows'))
      : reportWorkflows();
    const directory = resolve(
      'reports/workflows',
      receipt ? `installed-${receipt.node}` : 'browser',
      `${info.project.name}-${js}`,
    );
    await mkdir(directory, { recursive: true });
    const context = await browser.newContext({
      javaScriptEnabled: js,
      viewport: info.project.use.viewport,
      offline: true,
    });
    const page = await context.newPage();
    const requests: string[] = [],
      errors: string[] = [];
    context.on('request', (request) => {
      if (/^https?:/u.test(request.url())) requests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const results = [];
    for (const scenario of scenarios)
      for (const variant of scenario.variants) {
        const catalog = await loadPresentation(
          parseConfig(variant.options),
          dirname(variant.configFile),
        );
        for (const phase of ['initial', 'edited'] as const) {
          const surfaces = receipt
            ? [
                {
                  theme:
                    phase === 'initial' ? 'example.paper' : 'example.night',
                  layout: 'example.right-sidebar',
                },
              ]
            : [
                { theme: 'minimal', layout: 'document' },
                { theme: 'example.paper', layout: 'sidebar' },
                { theme: 'example.paper', layout: 'example.right-sidebar' },
                { theme: 'example.night', layout: 'example.right-sidebar' },
              ];
          for (const surface of surfaces) {
            const result = compile(
              scenario[phase],
              { ...variant.options, ...surface },
              undefined,
              catalog,
            );
            const name = `${scenario.id}-${phase}-${variant.id}`;
            let file;
            if (receipt) {
              const artifact = receipt.outputs[`workflow-${name}`];
              file = artifact.path;
              expect(
                createHash('sha256')
                  .update(await readFile(file))
                  .digest('hex'),
              ).toBe(artifact.sha256);
            } else {
              file = resolve(
                directory,
                `${name}-${surface.theme}-${surface.layout}.html`,
              );
              await writeFile(file, result.html);
            }
            await page.goto(pathToFileURL(file).href);
            await expect(page.locator('html')).toHaveAttribute(
              'data-theme',
              surface.theme,
            );
            if (variant.blockId)
              await expect(page.locator(`#${variant.blockId}`)).toHaveAttribute(
                'data-variant',
                variant.selected,
              );
            await workflowFidelity(page, result.document, js);
            const nav = page.locator('[data-toc]'),
              button = page.locator('[data-nav-toggle]');
            const sidebar = surface.layout !== 'document';
            if (
              info.project.name === 'desktop' &&
              surface.layout === 'example.right-sidebar'
            ) {
              const positions = await page.evaluate(() => ({
                nav: document.querySelector('nav')!.getBoundingClientRect()
                  .left,
                main: document.querySelector('main')!.getBoundingClientRect()
                  .right,
              }));
              expect(positions.nav).toBeGreaterThanOrEqual(positions.main);
            }
            if (info.project.name === 'mobile' && sidebar && js) {
              await expect(nav).toBeHidden();
              await button.focus();
              await page.keyboard.press('Enter');
              await expect(nav).toBeVisible();
              await page.keyboard.press('Escape');
              await expect(nav).toBeHidden();
              await expect(button).toBeFocused();
            } else if (!js) await expect(nav).toBeVisible();
            if (scenario.id === 'guide') {
              await page
                .locator('#guide-intro a[href="#build-command"]')
                .click();
              await expect(page).toHaveURL(/#build-command$/u);
            }
            if (js && scenario.id === 'tools') {
              const comparison = page.locator('#tools-comparison');
              const citations = await comparison
                .locator('.citations')
                .innerHTML();
              const other =
                variant.id === 'cards'
                  ? 'comparison.table'
                  : 'comparison.cards';
              await comparison.locator('select').selectOption(other);
              await expect(comparison).toHaveAttribute('data-variant', other);
              await workflowFidelity(page, result.document, js);
              expect(await comparison.locator('.citations').innerHTML()).toBe(
                citations,
              );
              await comparison.locator('select').selectOption(variant.selected);
              await expect(comparison).toHaveAttribute(
                'data-variant',
                variant.selected,
              );
            }
            if (js && variant.id === 'mindmap') {
              const root = page
                .locator('#architecture-map g.markmap-node circle')
                .first();
              await root.click();
              await expect(root).toHaveAttribute('aria-expanded', 'false');
              await expect(
                page.locator('#architecture-map g.markmap-node'),
              ).toHaveCount(1);
              await page.emulateMedia({ media: 'print' });
              await workflowFidelity(page, result.document, js, true);
              await page.emulateMedia({ media: 'screen' });
              await root.focus();
              await page.keyboard.press('Space');
              await expect(root).toHaveAttribute('aria-expanded', 'true');
              await workflowFidelity(page, result.document, js);
            }
            if (
              js &&
              surface.theme === 'example.night' &&
              surface.layout === 'example.right-sidebar'
            ) {
              await page.evaluate(() => scrollTo(0, 0));
              await page.screenshot({
                path: resolve(directory, `${name}.png`),
                fullPage: true,
              });
            }
            await page.emulateMedia({ media: 'print' });
            await workflowFidelity(page, result.document, js, true);
            await expect(nav).toBeHidden();
            await expect(page.locator('.sources')).toBeVisible();
            await page.emulateMedia({ media: 'screen' });
            results.push({
              scenario: scenario.id,
              phase,
              variant: variant.id,
              ...surface,
              js,
            });
          }
        }
      }
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await writeFile(
      resolve(directory, 'results.json'),
      JSON.stringify(
        {
          node: receipt?.node ?? process.version,
          cases: results.length,
          requests,
          errors,
          results,
        },
        null,
        2,
      ) + '\n',
    );
    await context.close();
  });
}
