import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Ajv } from 'ajv';
import {
  compile,
  createRegistry,
  documentSchema,
  Registry,
  html,
  loadRegistry,
} from '../dist/index.js';
import { comparisonDocument } from './helpers.mjs';

const root = resolve('.');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const blocks = read('examples/blocks.json');
const pluginPath = resolve('examples/comparison-plugin/index.mjs');
const pluginReport = read('examples/comparison-plugin/report.json');
const view = (id, options = {}) => ({
  id,
  supports: () => ({ supported: true, reason: 'Complete text.' }),
  score: () => 1,
  render: (b) => html`<p>${b.text ?? b.subject}</p>`,
  ...options,
});
const noteKind = (kind = 'fixture.note') => ({
  kind,
  dataVersion: '1.0',
  schema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  variants: [view(`${kind}.plain`)],
});
const plugin = (overrides = {}) => ({
  id: 'fixture.plugin',
  version: '1.0.0',
  pluginApiVersion: '1.0',
  kinds: [noteKind()],
  ...overrides,
});

test('built-in schemas retain the six-kind literal fixture, zero/negative metrics and raw event order', () => {
  const registry = createRegistry();
  assert.deepEqual(
    registry
      .definitions()
      .map((k) => k.kind)
      .sort(),
    [
      'comparison',
      'insight',
      'metrics',
      'prose',
      'richtext',
      'steps',
      'timeline',
    ],
  );
  const validate = new Ajv({ strict: true }).compile(documentSchema(registry));
  assert.equal(validate(blocks), true, JSON.stringify(validate.errors));
  const result = compile(blocks);
  assert.deepEqual(result.document.data, blocks);
  assert.equal(
    result.plan.blocks.find((b) => b.id === 'sequence').selected,
    'steps.stepper',
  );
  assert.match(result.html, /前次提供值：2 件/);
  assert.match(result.html, />0 件</);
  assert.match(result.html, />-1 件</);
  assert.match(result.html, /比較值：0 件/);
  assert.ok(
    result.html.indexOf('14:00（原始文字）') <
      result.html.indexOf('09:00（原始文字）'),
  );
  assert.match(result.html, /\*\*Markdown 標記\*\*/);
  assert.match(result.html, /&lt;b&gt;HTML&lt;\/b&gt;/);
  assert.equal(
    (result.html.match(/data-asset="semloom.content"/g) ?? []).length,
    1,
  );
  assert.ok(
    !compile(comparisonDocument()).html.includes(
      'data-asset="semloom.content"',
    ),
  );
  assert.equal(result.html, compile(blocks).html);
});

test('new block schemas reject malformed values and never silently convert or calculate them', () => {
  for (const block of [
    { kind: 'insight', level: 'danger', text: 'x' },
    { kind: 'metrics', items: [{ label: 'x', value: '3' }] },
    { kind: 'metrics', items: [{ label: 'x', value: Infinity }] },
    {
      kind: 'metrics',
      items: [{ label: 'x', value: 1, comparisonLabel: 'missing value' }],
    },
    { kind: 'steps', items: [] },
    { kind: 'steps', items: [{ title: 'x', css: 'invalid' }] },
    { kind: 'timeline', items: [{ title: 'x' }] },
    { kind: 'timeline', items: [{ title: 'x', time: 123 }] },
  ])
    assert.throws(() =>
      compile({
        schemaVersion: '1.0',
        title: 'T',
        sections: [{ title: 'S', blocks: [block] }],
      }),
    );
});

test('nested content named kind does not replace the Block discriminator in diagnostics', () => {
  const input = comparisonDocument({ kind: ['invalid cell'] });
  assert.throws(
    () => compile(input),
    (error) => {
      assert.ok(error.diagnostics.length > 0);
      assert.ok(
        error.diagnostics.some((d) => d.path.endsWith('/attributes/kind')),
      );
      assert.ok(error.diagnostics.every((d) => d.code !== 'UNKNOWN_KIND'));
      return true;
    },
  );
});

test('steps choose list/stepper using quantity and text while permitting lower-score overrides', () => {
  const input = structuredClone(blocks);
  const sequence = input.sections[1].blocks[0];
  sequence.items[0].description = '長'.repeat(141);
  assert.equal(
    compile(input).plan.blocks.find((b) => b.id === 'sequence').selected,
    'steps.list',
  );
  for (const selected of ['steps.list', 'steps.stepper']) {
    const output = compile(input, { overrides: { sequence: selected } });
    assert.equal(
      output.plan.blocks.find((b) => b.id === 'sequence').selected,
      selected,
    );
    assert.ok(output.html.includes('長'.repeat(141)));
    assert.deepEqual(output.document.data, input);
  }
});

test('local plugin new kind and comparison extension work through one effective Schema/Planner and Core citations', async () => {
  const registry = await loadRegistry([pluginPath]);
  assert.ok(
    new Ajv({ strict: true }).compile(documentSchema(registry))(pluginReport),
  );
  const output = compile(
    pluginReport,
    { plugins: [pluginPath], overrides: { tools: 'example.comparison.rows' } },
    registry,
  );
  assert.equal(
    output.plan.blocks.find((b) => b.id === 'tools').selected,
    'example.comparison.rows',
  );
  assert.equal((output.html.match(/本區塊來源/g) ?? []).length, 2);
  assert.equal(
    (output.html.match(/data-asset="example.base"/g) ?? []).length,
    1,
  );
  assert.match(output.html, /示意成本 \(點\)：0/);
  assert.deepEqual(output.document.data, pluginReport);
  assert.throws(
    () => compile(pluginReport, { plugins: [pluginPath] }),
    /PLUGIN_LOADING_REQUIRED/,
  );
});

test('extensions resolve after definitions regardless of plugin registration order and require matching data versions', () => {
  const extension = plugin({
    id: 'fixture.extension',
    kinds: [],
    extensions: [
      {
        targetKind: 'fixture.note',
        targetDataVersion: '1.0',
        variants: [view('fixture.note.extra')],
      },
    ],
  });
  for (const plugins of [
    [extension, plugin()],
    [plugin(), extension],
  ]) {
    assert.equal(
      createRegistry(plugins).kind('fixture.note').variants.length,
      2,
    );
  }
  for (const data of [
    {
      ...extension,
      extensions: [{ ...extension.extensions[0], targetKind: 'missing.kind' }],
    },
    {
      ...extension,
      extensions: [{ ...extension.extensions[0], targetDataVersion: '2.0' }],
    },
    { ...extension, extensions: [{ ...extension.extensions[0], schema: {} }] },
  ])
    assert.throws(
      () => createRegistry([plugin(), data]),
      /EXTENSION_TARGET|EXTENSION_VERSION|EXTENSION_MANIFEST/,
    );
});

test('unsupported extension candidates remain explainable and cannot be forced through an override', () => {
  const limited = plugin({
    kinds: [],
    extensions: [
      {
        targetKind: 'comparison',
        targetDataVersion: '1.0',
        variants: [
          view('fixture.comparison.limited', {
            supports: () => ({
              supported: false,
              reason: 'This fixture intentionally does not support the data.',
            }),
          }),
        ],
      },
    ],
  });
  const registry = createRegistry([limited]);
  const result = compile(comparisonDocument(), {}, registry);
  const candidate = result.plan.blocks[0].candidates.find(
    (c) => c.id === 'fixture.comparison.limited',
  );
  assert.equal(candidate.supported, false);
  assert.equal(candidate.score, null);
  assert.match(candidate.reason, /does not support/);
  assert.throws(
    () =>
      compile(
        comparisonDocument(),
        { overrides: { compare: candidate.id } },
        registry,
      ),
    /INVALID_OVERRIDE/,
  );
});

test('registry rejects ID/Schema/version/dependency conflicts before document processing and failed registration is atomic', () => {
  for (const plugins of [
    [plugin(), plugin()],
    [plugin(), plugin({ id: 'another.plugin' })],
    [
      plugin(),
      plugin({
        id: 'another.plugin',
        kinds: [noteKind('other.note')],
        extensions: [
          {
            targetKind: 'comparison',
            targetDataVersion: '1.0',
            variants: [view('comparison.cards')],
          },
        ],
      }),
    ],
    [plugin({ pluginApiVersion: '2.0' })],
    [plugin({ kinds: [{ ...noteKind(), dataVersion: '2.0' }] })],
    [plugin({ requires: { missing: '1.0.0' } })],
    [plugin({ requires: { 'semloom.builtin': '2.0.0' } })],
    [
      plugin({
        kinds: [
          {
            ...noteKind(),
            schema: { type: 'object', properties: { id: { type: 'string' } } },
          },
        ],
      }),
    ],
    [
      plugin({
        kinds: [
          {
            ...noteKind(),
            schema: {
              type: 'object',
              properties: { text: { type: 'unknown' } },
            },
          },
        ],
      }),
    ],
    [
      plugin({
        kinds: [
          {
            ...noteKind(),
            variants: [{ ...view('fixture.bad'), render: 'not a function' }],
          },
        ],
      }),
    ],
  ])
    assert.throws(() => createRegistry(plugins));
  const registry = new Registry();
  registry.register(plugin());
  assert.throws(
    () => registry.register(plugin({ id: 'different.plugin' })),
    /KIND_CONFLICT/,
  );
  assert.equal(registry.definitions().length, 1);
});

test('CSS assets are selected on demand, dependency-ordered and deduplicated; conflicts and external dependencies fail', () => {
  const asset = {
    id: 'fixture.base',
    type: 'css',
    content: '.fixture{color:var(--ink)}',
  };
  const child = {
    id: 'fixture.child',
    type: 'css',
    content: '.fixture-child{margin:0}',
    dependsOn: ['fixture.base'],
  };
  const aliases = { id: 'fixture.alias', type: 'css', content: asset.content };
  const registered = plugin({
    kinds: [
      {
        ...noteKind(),
        variants: [
          view('fixture.note.assets', { assets: [child, asset, aliases] }),
        ],
      },
    ],
  });
  const registry = createRegistry([registered]);
  assert.deepEqual(
    registry.assetsFor(['fixture.note.assets']).map((a) => a.id),
    ['fixture.alias', 'fixture.child'],
  );
  assert.deepEqual(registry.assetsFor(['comparison.cards']), []);
  const lateDependency = {
    id: 'fixture.late',
    type: 'css',
    content: '.late{margin:0}',
  };
  const aliasWithDependency = { ...aliases, dependsOn: ['fixture.late'] };
  const dependencyRegistry = createRegistry([
    plugin({
      kinds: [
        {
          ...noteKind(),
          variants: [
            view('fixture.note.assets', {
              assets: [asset, aliasWithDependency, lateDependency],
            }),
          ],
        },
      ],
    }),
  ]);
  assert.deepEqual(
    dependencyRegistry.assetsFor(['fixture.note.assets']).map((a) => a.id),
    ['fixture.late', 'fixture.alias'],
  );
  for (const assets of [
    [asset, { ...asset, content: '.x{padding:0}' }],
    [{ ...child, dependsOn: ['missing'] }],
    [{ ...asset, dependsOn: ['fixture.child'] }, child],
    [{ ...asset, type: 'js' }],
    ...[
      '@import "https://x.test";',
      '.x{background:url(https://x.test)}',
      '.x{background:image-set("//x.test" 1x)}',
      '</style><script>alert(1)</script>',
      '.x{background:u\\72l(x)}',
    ].map((content) => [{ ...asset, content }]),
  ])
    assert.throws(() =>
      createRegistry([
        plugin({
          kinds: [
            {
              ...noteKind(),
              variants: [view('fixture.note.assets', { assets })],
            },
          ],
        }),
      ]),
    );
});

test('CLI uses plugin paths relative to config across schema/validate/build/list, independent of working directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-plugin-cli-'));
  const config = resolve('examples/comparison-plugin/presentation.json');
  const run = (...args) =>
    spawnSync(process.execPath, [resolve('dist/cli/main.js'), ...args], {
      cwd: directory,
      encoding: 'utf8',
    });
  for (const args of [
    ['schema'],
    ['plugins', 'list'],
    ['validate', resolve('examples/comparison-plugin/report.json')],
    [
      'build',
      resolve('examples/comparison-plugin/report.json'),
      '-o',
      join(directory, 'report.html'),
      '--explain',
    ],
  ]) {
    const result = run(...args, '--config', config);
    assert.equal(result.status, 0, result.stderr);
    if (args[0] === 'schema')
      assert.ok(
        new Ajv({ strict: true }).compile(JSON.parse(result.stdout))(
          pluginReport,
        ),
      );
    if (args[0] === 'plugins')
      assert.match(result.stdout, /example.comparison.rows/);
    if (args[0] === 'build')
      assert.match(result.stderr, /"selected": "example.comparison.rows"/);
  }
  assert.equal(
    run('validate', resolve('examples/comparison-plugin/report.json')).status,
    2,
  );
  for (const path of [
    'some-package',
    'https://example.test/plugin.mjs',
    './not-found.mjs',
  ]) {
    const config = join(directory, 'invalid.json');
    writeFileSync(config, JSON.stringify({ plugins: [path] }));
    const failed = run('schema', '--config', config);
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /PLUGIN_PATH|PLUGIN_LOAD/);
  }
});

test('CLI rejects malformed exports/API mismatches and leaves an existing output untouched', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-plugin-error-'));
  const file = join(directory, 'bad.mjs');
  const config = join(directory, 'presentation.json');
  const output = join(directory, 'report.html');
  writeFileSync(config, JSON.stringify({ plugins: ['./bad.mjs'] }));
  writeFileSync(output, 'previous report');
  for (const module of [
    'export default null;',
    'export default {id:"test",version:"1",pluginApiVersion:"2.0",kinds:[]};',
    'export default {id:"test",version:"1",pluginApiVersion:"1.0",kinds:[]};',
  ]) {
    writeFileSync(file, module);
    const result = spawnSync(
      process.execPath,
      [
        resolve('dist/cli/main.js'),
        'build',
        'examples/comparison.json',
        '--config',
        config,
        '-o',
        output,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), 'previous report');
  }
});
