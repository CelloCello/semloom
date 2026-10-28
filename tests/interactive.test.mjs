import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  compile,
  loadRegistry,
  parseConfig,
  createRegistry,
  html,
  safeUrl,
} from '../dist/index.js';
import { safeUrl as browserSafeUrl } from '../dist/browser/index.js';
import { comparisonDocument, research } from './helpers.mjs';

const payload = (output) =>
  JSON.parse(
    output.match(/id="semloom-interactive-data">([\s\S]*?)<\/script>/)[1],
  );
const script = (output) =>
  output.match(/<script data-semloom-interactive>([\s\S]*?)<\/script>/)[1];
const cli = (...args) =>
  spawnSync(process.execPath, ['dist/cli/main.js', ...args], {
    encoding: 'utf8',
  });

test('interactive opt-in bundles compatible adapters once and safely embeds resolved data; no candidates stays static', async () => {
  assert.equal(parseConfig().interactive, false);
  assert.equal(browserSafeUrl, safeUrl);
  assert.equal(parseConfig({ interactive: true }).interactive, true);
  assert.throws(() => parseConfig({ interactive: 1 }));
  const registry = await loadRegistry([
    resolve('tests/fixtures/browser-plugin.mjs'),
  ]);
  const input = comparisonDocument({
    zero: 0,
    no: false,
    empty: '',
    nil: null,
  });
  input.sections[0].blocks.push({
    ...structuredClone(input.sections[0].blocks[0]),
    id: 'another',
  });
  input.sections[0].blocks[0].subject =
    '</script><img src=x onerror=alert(1)>\u2028&';
  const output = compile(input, { interactive: true }, registry);
  assert.equal(
    output.html,
    compile(input, { interactive: true }, registry).html,
  );
  const data = payload(output.html);
  assert.equal(data.length, 2);
  assert.deepEqual(data[0].data, {
    ...input.sections[0].blocks[0],
    id: 'compare',
  });
  assert.ok(data[0].candidates.includes('fixture.tracked')); // Low-score, compatible.
  assert.ok(!data[0].candidates.includes('fixture.static'));
  assert.ok(!data[0].candidates.includes('fixture.unsupported'));
  assert.ok(!script(output.html).includes('MUST_NOT_BE_BUNDLED'));
  assert.equal(
    (output.html.match(/<script data-semloom-interactive>/g) ?? []).length,
    1,
  );
  assert.equal(
    (output.html.match(/data-asset="fixture.interactive"/g) ?? []).length,
    1,
  );
  assert.ok(
    !output.html
      .match(/id="semloom-interactive-data">([\s\S]*?)<\/script>/)[1]
      .includes('<'),
  );
  const hash = createHash('sha256')
    .update(script(output.html))
    .digest('base64');
  assert.ok(output.html.replaceAll('&#39;', "'").includes(`'sha256-${hash}'`));
  assert.ok(!compile(research).html.includes('data-semloom-interactive'));
  const automatic = comparisonDocument();
  delete automatic.sections[0].blocks[0].id;
  const resolved = compile(automatic, { interactive: true });
  assert.equal(
    payload(resolved.html)[0].data.id,
    resolved.document.blocks[0].id,
  );
  const prose = {
    schemaVersion: '1.0',
    title: 'S',
    sections: [{ title: 'S', blocks: [{ kind: 'prose', text: 'text' }] }],
  };
  assert.equal(compile(prose, { interactive: true }).html, compile(prose).html);
});

test('one browser candidate gets no selector; browser descriptors are cloned and validated', () => {
  const entry = resolve('dist/browser/adapters/cards.js');
  const view = (id) => ({
    id,
    supports: () => ({ supported: true, reason: 'ok' }),
    score: () => 0,
    render: () => html`<p>Static</p>`,
  });
  const plugin = (variants) => ({
    id: 'fixture.only',
    version: '1',
    pluginApiVersion: '1.0',
    kinds: [
      {
        kind: 'fixture.only',
        dataVersion: '1.0',
        schema: { type: 'object', properties: {} },
        variants,
      },
    ],
  });
  const registry = createRegistry([
    plugin([
      {
        ...view('fixture.only.browser'),
        browser: { entry, exportName: 'createView' },
      },
      view('fixture.only.static'),
    ]),
  ]);
  const doc = {
    schemaVersion: '1.0',
    title: 'S',
    sections: [{ title: 'S', blocks: [{ kind: 'fixture.only' }] }],
  };
  assert.ok(
    !compile(doc, { interactive: true }, registry).html.includes(
      'data-switcher',
    ),
  );
  const copied = registry.kind('fixture.only');
  copied.variants[0].browser.entry = 'mutated';
  assert.equal(
    registry.variant('fixture.only', 'fixture.only.browser').browser.entry,
    entry,
  );
  for (const browser of [
    { entry, exportName: 'x-y' },
    { entry: 2, exportName: 'x' },
    { entry, exportName: 'x', label: '' },
    { entry, exportName: 'x', unknown: true },
  ])
    assert.throws(
      () => createRegistry([plugin([{ ...view('fixture.bad'), browser }])]),
      /BROWSER_MANIFEST/,
    );
});

test('browser bundle fails clearly for missing exports, Node APIs, remote imports and entries; static build remains available', () => {
  const folder = mkdtempSync(join(tmpdir(), 'semloom-browser-'));
  for (const [name, contents] of [
    ['export', 'export const other = 1'],
    [
      'node',
      "import fs from 'node:fs';export const createView = () => fs.readFileSync('x')",
    ],
    [
      'remote',
      "import view from 'https://invalid.example/view.js';export const createView=view",
    ],
  ]) {
    const entry = join(folder, `${name}.mjs`);
    writeFileSync(entry, contents);
    const plugin = {
      id: 'fixture.bundle',
      version: '1',
      pluginApiVersion: '1.0',
      extensions: [
        {
          targetKind: 'comparison',
          targetDataVersion: '1.0',
          variants: [
            {
              id: 'fixture.bundle',
              supports: () => ({ supported: true, reason: 'ok' }),
              score: () => 0,
              render: () => html`<p>Static</p>`,
              browser: { entry, exportName: 'createView' },
            },
          ],
        },
      ],
    };
    const registry = createRegistry([plugin]);
    assert.ok(compile(research, {}, registry).html);
    assert.throws(
      () => compile(research, { interactive: true }, registry),
      /BROWSER_BUNDLE/,
    );
  }
});

test('CLI interactive precedence, plugin-relative entries, capability listing and atomic failure', () => {
  const folder = mkdtempSync(join(tmpdir(), 'semloom-interactive-cli-'));
  const config = join(folder, 'config.json');
  const output = join(folder, 'report.html');
  writeFileSync(config, JSON.stringify({ interactive: true }));
  assert.equal(
    cli(
      'build',
      'examples/comparison.json',
      '--config',
      config,
      '--no-interactive',
      '-o',
      output,
    ).status,
    0,
  );
  assert.ok(!readFileSync(output, 'utf8').includes('data-semloom-interactive'));
  assert.equal(
    cli('build', 'examples/comparison.json', '--config', config, '-o', output)
      .status,
    0,
  );
  assert.ok(readFileSync(output, 'utf8').includes('data-semloom-interactive'));
  writeFileSync(config, JSON.stringify({ interactive: false }));
  assert.equal(
    cli(
      'build',
      'examples/comparison.json',
      '--config',
      config,
      '--interactive',
      '-o',
      output,
    ).status,
    0,
  );
  const previous = readFileSync(output);
  const badEntry = join(folder, 'bad-adapter.mjs');
  const badPlugin = join(folder, 'bad-plugin.mjs');
  writeFileSync(badEntry, 'export const other = 1;');
  writeFileSync(
    badPlugin,
    `import {html} from ${JSON.stringify(pathToFileURL(resolve('dist/index.js')).href)};
export default {id:'fixture.atomic', version:'1', pluginApiVersion:'1.0', extensions:[{targetKind:'comparison',targetDataVersion:'1.0',variants:[{id:'fixture.atomic', supports:()=>({supported:true,reason:'ok'}),score:()=>0,render:()=>html\`<p>static</p>\`,browser:{entry:'./bad-adapter.mjs',exportName:'createView'}}]}]};`,
  );
  writeFileSync(
    config,
    JSON.stringify({ plugins: [badPlugin], interactive: true }),
  );
  const bundled = cli(
    'build',
    'examples/comparison.json',
    '--config',
    config,
    '-o',
    output,
  );
  assert.equal(bundled.status, 1);
  assert.match(bundled.stderr, /BROWSER_BUNDLE/);
  assert.deepEqual(readFileSync(output), previous);
  for (const args of [
    ['--interactive', '--no-interactive'],
    ['--interactive=true'],
  ]) {
    assert.equal(
      cli('build', 'examples/comparison.json', ...args, '-o', output).status,
      2,
    );
    assert.deepEqual(readFileSync(output), previous);
  }
  assert.equal(
    cli('validate', 'examples/comparison.json', '--interactive').status,
    2,
  );
  writeFileSync(config, JSON.stringify({ interactive: 'bad' }));
  assert.equal(
    cli(
      'build',
      'examples/comparison.json',
      '--config',
      config,
      '--no-interactive',
      '-o',
      output,
    ).status,
    2,
  );
  const local = cli(
    'build',
    'examples/comparison-plugin/report.json',
    '--config',
    'examples/comparison-plugin/presentation.json',
    '--interactive',
    '-o',
    output,
  );
  assert.equal(local.status, 0, local.stderr);
  assert.ok(
    payload(readFileSync(output, 'utf8'))[0].candidates.includes(
      'example.comparison.rows',
    ),
  );
  const listing = JSON.parse(
    cli(
      'plugins',
      'list',
      '--config',
      'examples/comparison-plugin/presentation.json',
    ).stdout,
  );
  assert.deepEqual(listing[1].extensions[0].browserVariants, [
    'example.comparison.rows',
  ]);
});
