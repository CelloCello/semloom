import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  compile,
  createPresentation,
  loadPresentation,
  parseConfig,
  createRegistry,
  html,
  SemloomError,
} from '../dist/index.js';
import { technicalGuide } from './fixtures/technical-guide.mjs';

const configFile = resolve('examples/presentation/presentation.json');
const raw = JSON.parse(readFileSync(configFile, 'utf8'));
const load = () =>
  loadPresentation(parseConfig(raw), resolve('examples/presentation'));
const theme = () => ({
  id: 'custom.paper',
  themeApiVersion: '1.0',
  tokens: { accent: '#123456' },
});
const layout = () => ({
  id: 'custom.right',
  layoutApiVersion: '1.0',
  base: 'sidebar',
  css: '[data-layout-id="custom.right"] .page{column-gap:2rem}',
});

test('prepared presentation data is immutable, names are deterministic and baseline choices remain compatible', () => {
  const input = { themes: [theme()], layouts: [layout()] };
  const catalog = createPresentation(input);
  input.themes[0].tokens.accent = '#ffffff';
  const selected = catalog.resolve('custom.paper', 'custom.right');
  assert.equal(selected.theme.tokens.accent, '#123456');
  assert.equal(selected.base, 'sidebar');
  selected.layout.base = 'document';
  selected.theme.tokens.accent = '#ffffff';
  assert.equal(catalog.resolve('custom.paper', 'custom.right').base, 'sidebar');
  assert.equal(
    catalog.resolve('custom.paper', 'custom.right').theme.tokens.accent,
    '#123456',
  );
  catalog.names().themes.push('mutated');
  assert.ok(!catalog.names().themes.includes('mutated'));
  assert.deepEqual(createPresentation().resolve('minimal', 'document'), {
    base: 'document',
  });
  assert.throws(
    () => catalog.resolve('absent', 'custom.right'),
    /UNKNOWN_THEME/,
  );
  assert.throws(
    () => catalog.resolve('custom.paper', 'absent'),
    /UNKNOWN_LAYOUT/,
  );
});

test('manifest contracts reject reserved IDs, wrong versions, bases, token values and unsafe or malformed CSS', () => {
  for (const definitions of [
    { themes: [{ ...theme(), id: 'minimal' }] },
    { themes: [theme(), theme()] },
    { layouts: [{ ...layout(), id: 'sidebar' }] },
    { layouts: [layout(), layout()] },
    { themes: [{ ...theme(), themeApiVersion: '2.0' }] },
    { layouts: [{ ...layout(), layoutApiVersion: '2.0' }] },
    { layouts: [{ ...layout(), base: 'custom.right' }] },
    { themes: [{ ...theme(), extra: true }] },
    { layouts: [{ ...layout(), render: 'arbitrary' }] },
    ...[
      { accent: 'red' },
      { ink: '#fff;}</style>' },
      { measure: 'calc(1px)' },
      { space: 'url(x)' },
      { 'title-weight': 'bold' },
      { 'font-body': 'url(x)' },
      { unknown: 'x' },
      { 'body-leading': 1.8 },
    ].map((tokens) => ({ themes: [{ ...theme(), tokens }] })),
    ...[
      '@import "x";',
      'a{background:url(x)}',
      '</style><script>x</script>',
      '/*comment*/a{}',
      'a{color:red',
      'a{color:red}\\',
    ].map((css) => ({ layouts: [{ ...layout(), css }] })),
  ])
    assert.throws(() => createPresentation(definitions), SemloomError);
  assert.doesNotThrow(() =>
    createPresentation({
      themes: [
        {
          ...theme(),
          tokens: {
            'font-body': '-apple-system,"PingFang TC",sans-serif',
            radius: '0',
            measure: '75ch',
          },
        },
      ],
    }),
  );
});

test('Theme affects appearance and external Layout passes only its base to Plugin, Plan and browser data', async () => {
  const catalog = await load();
  const input = technicalGuide();
  const first = compile(
    input,
    { ...raw, theme: 'example.paper' },
    undefined,
    catalog,
  );
  const dark = compile(
    input,
    { ...raw, theme: 'example.night' },
    undefined,
    catalog,
  );
  assert.deepEqual(first.plan, dark.plan);
  assert.deepEqual(first.document.data, input);
  assert.equal(first.plan.context.layout, 'sidebar');
  assert.ok(first.html.includes('data-layout-id="example.right-sidebar"'));
  assert.ok(first.html.includes('--accent:#674224'));
  assert.ok(first.html.includes('--font-body:system-ui'));
  assert.ok(
    first.html.indexOf('data-semloom-print') >
      first.html.indexOf('data-semloom-presentation'),
  );
  assert.equal(first.html, compile(input, raw, undefined, catalog).html);
  assert.throws(() => compile(input, raw), /PRESENTATION_LOADING_REQUIRED/);
  const seen = [];
  const registry = createRegistry([
    {
      id: 'fixture.layout',
      version: '1',
      pluginApiVersion: '1.0',
      extensions: [
        {
          targetKind: 'prose',
          targetDataVersion: '1.0',
          variants: [
            {
              id: 'fixture.sidebar',
              supports: (_data, context) => {
                seen.push(context);
                return {
                  supported: context.layout === 'sidebar',
                  reason: 'Uses sidebar base',
                };
              },
              score: () => 100,
              render: (data) => html`<p>${data.text}</p>`,
            },
          ],
        },
      ],
    },
  ]);
  const output = compile(input, raw, registry, catalog);
  assert.equal(output.plan.blocks.at(-1).selected, 'fixture.sidebar');
  assert.ok(
    seen.every(
      (context) => context.layout === 'sidebar' && !('theme' in context),
    ),
  );
  assert.equal(
    compile(input, {}, registry).plan.blocks.at(-1).selected,
    'prose.paragraph',
  );
});

test('local loader uses config/manifest directories, rejects unresolved file shapes and reports missing or oversized files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-presentation-'));
  const path = join(directory, 'theme.json');
  const css = join(directory, 'theme.css');
  writeFileSync(css, '.prose{font-weight:500}');
  writeFileSync(path, JSON.stringify({ ...theme(), cssFile: './theme.css' }));
  const catalog = await loadPresentation(
    { themes: ['./theme.json'], layouts: [] },
    directory,
  );
  assert.equal(
    catalog.resolve('custom.paper', 'document').theme.css,
    '.prose{font-weight:500}',
  );
  assert.deepEqual(catalog.sourceFiles, [path, css]);
  assert.throws(
    () =>
      createPresentation({ themes: [{ ...theme(), cssFile: './theme.css' }] }),
    /SCHEMA/,
  );
  for (const value of [
    { themes: ['https://example.com/theme.json'], layouts: [] },
    { themes: ['./absent.json'], layouts: [] },
    { themes: ['./theme.css'], layouts: [] },
  ])
    await assert.rejects(loadPresentation(value, directory), SemloomError);
  writeFileSync(path, JSON.stringify({ ...theme(), cssFile: './absent.css' }));
  await assert.rejects(
    loadPresentation({ themes: ['./theme.json'], layouts: [] }, directory),
    /PRESENTATION_READ/,
  );
  writeFileSync(path, JSON.stringify({ ...theme(), cssFile: './theme.css' }));
  writeFileSync(css, ' '.repeat(200001));
  await assert.rejects(
    loadPresentation({ themes: ['./theme.json'], layouts: [] }, directory),
    /PRESENTATION_READ/,
  );
  writeFileSync(path, '{}'.repeat(500001));
  await assert.rejects(
    loadPresentation({ themes: ['./theme.json'], layouts: [] }, directory),
    /PRESENTATION_READ/,
  );
});

test('CLI listings/schema/validate/build load the same presentation from another cwd and protect manifest/CSS files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-presentation-cli-'));
  const cli = (...args) =>
    spawnSync(process.execPath, [resolve('dist/cli/main.js'), ...args], {
      cwd: directory,
      encoding: 'utf8',
    });
  const input = resolve('examples/technical-guide.json');
  const output = join(directory, 'report.html');
  for (const kind of ['themes', 'layouts']) {
    const listed = cli(kind, 'list', '--config', configFile);
    assert.equal(listed.status, 0, listed.stderr);
    assert.ok(
      JSON.parse(listed.stdout).includes(
        kind === 'themes' ? 'example.paper' : 'example.right-sidebar',
      ),
    );
  }
  assert.equal(cli('schema', '--config', configFile).status, 0);
  assert.equal(cli('validate', input, '--config', configFile).status, 0);
  const built = cli(
    'build',
    input,
    '--config',
    configFile,
    '--theme',
    'example.night',
    '-o',
    output,
    '--explain',
  );
  assert.equal(built.status, 0, built.stderr);
  assert.ok(
    readFileSync(output, 'utf8').includes('data-theme="example.night"'),
  );
  assert.match(built.stderr, /"layout": "sidebar"/);
  const previous = readFileSync(output);
  const bad = join(directory, 'config.json');
  writeFileSync(
    bad,
    JSON.stringify({
      ...raw,
      themes: [resolve('examples/presentation/paper.json')],
      layouts: [resolve('examples/presentation/right-sidebar.json')],
      theme: 'absent',
    }),
  );
  assert.equal(
    cli('build', input, '--config', bad, '--theme', 'minimal', '-o', output)
      .status,
    2,
  );
  assert.deepEqual(readFileSync(output), previous);
  for (const file of [
    'examples/presentation/paper.json',
    'examples/presentation/styles/paper.css',
  ]) {
    const original = readFileSync(file);
    assert.equal(
      cli('build', input, '--config', configFile, '-o', resolve(file)).status,
      2,
    );
    assert.deepEqual(readFileSync(file), original);
  }
});
