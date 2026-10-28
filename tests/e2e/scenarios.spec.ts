import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from '../../dist/index.js';
import type {
  Block,
  ComparisonBlock,
  InsightBlock,
  MetricsBlock,
  ProseBlock,
  StepsBlock,
  TimelineBlock,
} from '../../src/core/types.js';
import { loadScenarios } from '../../scripts/scenarios.mjs';

function facts(block: Block): string[] {
  switch (block.kind) {
    case 'prose':
      return [(block as ProseBlock).text];
    case 'insight':
      return [(block as InsightBlock).text];
    case 'metrics':
      return (block as MetricsBlock).items.flatMap((item) => [
        item.label,
        String(item.value),
        ...(item.unit ? [item.unit] : []),
        ...(item.comparisonValue !== undefined
          ? [String(item.comparisonValue)]
          : []),
        ...(item.comparisonLabel ? [item.comparisonLabel] : []),
      ]);
    case 'steps':
      return [
        ...((block as StepsBlock).title ? [(block as StepsBlock).title!] : []),
        ...(block as StepsBlock).items.flatMap((item) => [
          item.title,
          ...(item.description ? [item.description] : []),
        ]),
      ];
    case 'timeline':
      return [
        ...((block as TimelineBlock).title
          ? [(block as TimelineBlock).title!]
          : []),
        ...(block as TimelineBlock).items.flatMap((item) => [
          item.time,
          item.title,
          ...(item.description ? [item.description] : []),
        ]),
      ];
    default:
      return [];
  }
}
async function comparisonFidelity(page: Page, block: ComparisonBlock) {
  const region = page.locator(`#${block.id}`);
  await expect(region).toContainText(block.subject);
  const values = block.items.flatMap((item) =>
    block.fields.map((field) => {
      const value = Object.hasOwn(item.attributes, field.key)
        ? item.attributes[field.key]
        : undefined;
      return value === undefined || value === null ? '未提供' : String(value);
    }),
  );
  if ((await region.getAttribute('data-variant')) === 'comparison.cards') {
    expect(
      await region.locator('.comparison-card dd').allTextContents(),
    ).toEqual(values);
    expect(
      await region
        .locator('.comparison-card > :is(h2,h3,h4,h5,h6)')
        .allTextContents(),
    ).toEqual(block.items.map((item) => item.name));
  } else {
    expect(await region.locator('tbody td').allTextContents()).toEqual(values);
    expect(await region.locator('tbody th').allTextContents()).toEqual(
      block.items.map((item) => item.name),
    );
  }
  for (const field of block.fields)
    await expect(region).toContainText(
      `${field.label}${field.unit ? ` (${field.unit})` : ''}`,
    );
}

test('additional fixed scenarios preserve initial/edit facts through fixed, Auto and offline interactive views', async ({
  browser,
}, testInfo) => {
  const folder = resolve('reports/benchmark/scenarios');
  await mkdir(folder, { recursive: true });
  for (const scenario of loadScenarios())
    for (const phase of ['initial', 'edited'])
      for (const condition of ['fixed', 'auto', 'interactive']) {
        const context = await browser.newContext({
          viewport: testInfo.project.use.viewport,
          javaScriptEnabled: condition === 'interactive',
        });
        const page = await context.newPage();
        const requests: string[] = [];
        const errors: string[] = [];
        page.on('request', (request) => {
          if (/^https?:/u.test(request.url())) requests.push(request.url());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        const result = compile(
          scenario[phase],
          condition === 'fixed'
            ? { overrides: { [scenario.comparisonId]: 'comparison.table' } }
            : { interactive: condition === 'interactive' },
        );
        const file = resolve(
          folder,
          `${testInfo.project.name}-${scenario.id}-${phase}-${condition}.html`,
        );
        await writeFile(file, result.html);
        await page.goto(pathToFileURL(file).href);
        await expect(page.locator('h1')).toHaveText(scenario[phase].title);
        expect(
          result.plan.blocks.find(
            (block) => block.id === scenario.comparisonId,
          )!.selected,
        ).toBe(
          condition === 'fixed' ? 'comparison.table' : scenario.expectedAuto,
        );
        for (const block of result.document.blocks) {
          const rendered = page.locator(`#${block.id}`);
          for (const fact of facts(block.data))
            expect(await rendered.textContent()).toContain(fact);
          const titles = (block.data.sourceIds ?? []).map(
            (id) =>
              result.document.data.sources!.find((source) => source.id === id)!
                .title,
          );
          expect(
            await rendered.locator('.citations a').allTextContents(),
          ).toEqual(titles);
          if (block.data.kind === 'comparison')
            await comparisonFidelity(page, {
              ...block.data,
              id: block.id,
            } as ComparisonBlock);
        }
        const compared = result.document.blocks.find(
          (block) => block.id === scenario.comparisonId,
        )!;
        const citations = await page
          .locator(`#${scenario.comparisonId} .citations`)
          .innerHTML();
        await context.setOffline(true);
        if (condition === 'interactive') {
          const alternate =
            scenario.expectedAuto === 'comparison.cards'
              ? 'comparison.table'
              : 'comparison.cards';
          await page
            .locator(`#${scenario.comparisonId} select`)
            .selectOption(alternate);
          await comparisonFidelity(page, {
            ...compared.data,
            id: compared.id,
          } as ComparisonBlock);
          expect(
            await page
              .locator(`#${scenario.comparisonId} .citations`)
              .innerHTML(),
          ).toBe(citations);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.emulateMedia({ media: 'print' });
        await expect(page.getByRole('navigation')).toBeHidden();
        await expect(page.locator('.sources')).toBeVisible();
        await comparisonFidelity(page, {
          ...compared.data,
          id: compared.id,
        } as ComparisonBlock);
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
        await context.close();
      }
});
