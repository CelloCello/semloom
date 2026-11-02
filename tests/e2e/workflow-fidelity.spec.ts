import { test, expect } from '@playwright/test';
import { compile } from '../../dist/index.js';
import { reportWorkflows } from '../fixtures/report-workflows.mjs';
import { workflowFidelity } from './workflow-fidelity.js';

test('batched workflow fidelity retains exact data, strict hosts and nested-list waits', async ({
  page,
}) => {
  const [tools, guide] = reportWorkflows();
  const report = compile(guide.initial);
  const reset = () => page.setContent(report.html);
  await reset();
  await workflowFidelity(page, report.document, true);
  const mutations = [
    () => {
      document.querySelector('#build-command code')!.textContent += ' ';
    },
    () => {
      const child = document.querySelector(
        '#guide-checklist > .semloom-list .semloom-list',
      )!;
      const changed = document.createElement(
        child.tagName === 'OL' ? 'ul' : 'ol',
      );
      changed.className = child.className;
      changed.innerHTML = child.innerHTML;
      child.replaceWith(changed);
    },
    () => {
      const strong = document.querySelector('#guide-checklist strong')!;
      strong.replaceWith(...strong.childNodes);
    },
    () => {
      document
        .querySelector('#guide-intro a')!
        .setAttribute('href', '#review-notes');
    },
    () => {
      document.querySelector('#guide-checklist .citations a')!.textContent =
        'Changed citation';
    },
    () => {
      document.querySelector('.sources > ol > li')!.textContent =
        'Changed source';
    },
    () => {
      document.querySelector('[data-toc] [data-section]')!.textContent =
        'Changed heading';
    },
    () => {
      const link = document.createElement('a');
      link.href = '#missing';
      document.body.append(link);
    },
    () => {
      const host = document.querySelector('#review-notes')!;
      host.after(host.cloneNode(true));
    },
    () => {
      const code = document.querySelector('#build-command code')!;
      code.after(code.cloneNode(true));
    },
  ];
  for (const mutate of mutations) {
    await reset();
    await page.evaluate(mutate);
    await expect(
      workflowFidelity(page, report.document, true),
    ).rejects.toThrow();
  }
  for (const variant of ['comparison.cards', 'comparison.table']) {
    const comparison = compile(tools.initial, {
      overrides: { 'tools-comparison': variant },
    });
    await page.setContent(comparison.html);
    await workflowFidelity(page, comparison.document, true);
    await page
      .locator(
        variant === 'comparison.cards' ? '.comparison-card dd' : 'tbody td',
      )
      .first()
      .evaluate((cell) => {
        cell.textContent = 'Changed value';
      });
    await expect(
      workflowFidelity(page, comparison.document, true),
    ).rejects.toThrow();
  }
  await reset();
  // Simulate a deferred DOM update, rather than replacing retrying assertions
  // with immediate snapshots. No test-side sleep is used to await restoration.
  await page.evaluate(() => {
    const list = document.querySelector(
      '#guide-checklist > .semloom-list .semloom-list',
    )!;
    const item = list.lastElementChild!;
    item.remove();
    setTimeout(() => list.append(item), 100);
  });
  await workflowFidelity(page, report.document, true);
});
