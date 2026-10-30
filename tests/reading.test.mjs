import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  compile,
  loadPresentation,
  parseConfig,
  themeNames,
} from '../dist/index.js';

test('reading preset composes independent external presentation and explicit responsive comparison without changing Auto', async () => {
  const input = JSON.parse(
    await readFile('examples/reading-report.json', 'utf8'),
  );
  const original = structuredClone(input);
  const config = parseConfig(
    JSON.parse(await readFile('examples/reading-presentation.json', 'utf8')),
  );
  const catalog = await loadPresentation(config, resolve('examples'));
  const base = compile(input);
  assert.equal(
    base.plan.blocks.find((b) => b.id === 'changes-comparison').selected,
    'comparison.table',
  );
  assert.ok(!base.html.includes('data-asset="semloom.comparison-responsive"'));
  const output = compile(input, config, undefined, catalog);
  assert.equal(output.plan.context.layout, 'sidebar');
  assert.equal(
    output.plan.blocks.find((b) => b.id === 'changes-comparison').selected,
    'comparison.responsive',
  );
  assert.ok(output.html.includes('data-asset="semloom.comparison-responsive"'));
  assert.match(output.html, /data-theme="example.reading"/);
  assert.match(output.html, /data-layout-id="example.paper-sidebar"/);
  assert.equal((output.html.match(/<nav /g) ?? []).length, 1);
  assert.deepEqual(output.document.data, original);
  const views = new Set(output.plan.blocks.map((b) => b.kind));
  assert.equal(views.size, 10);
  for (const theme of [...themeNames, 'example.reading']) {
    const themed = compile(input, { ...config, theme }, undefined, catalog);
    assert.deepEqual(themed.document.data, original);
    assert.deepEqual(themed.plan, output.plan);
  }
  for (const layout of ['document', 'sidebar']) {
    const result = compile(input, { ...config, layout }, undefined, catalog);
    assert.deepEqual(result.document.data, original);
    assert.ok(!result.html.includes('data-layout-id='));
  }
  assert.deepEqual(input, original);
  assert.equal(compile(input, config, undefined, catalog).html, output.html);
});
