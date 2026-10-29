import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonDocument } from './helpers.mjs';
import { compile, parseConfig, loadPresentation } from '../dist/index.js';
import { hierarchyDocument } from './fixtures/hierarchy.mjs';
import { technicalGuide } from './fixtures/technical-guide.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = (...args) =>
  spawnSync(process.execPath, ['dist/cli/main.js', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
test('CLI help, listing, Schema stdout and validate work from compiled output', () => {
  const version = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  ).version;
  assert.equal(cli('--version').stdout, version + '\n');
  assert.equal(cli('-v').status, 0);
  assert.match(
    cli('--help').stdout,
    /Supports prose, comparison, insight, metrics, steps, timeline/,
  );
  assert.deepEqual(JSON.parse(cli('themes', 'list').stdout), [
    'minimal',
    'editorial',
    'ocean',
    'graphite',
    'signal',
    'midnight',
  ]);
  assert.equal(
    JSON.parse(cli('plugins', 'list').stdout)[0].id,
    'semloom.builtin',
  );
  const schema = cli('schema');
  assert.equal(schema.status, 0);
  assert.equal(schema.stderr, '');
  assert.equal(JSON.parse(schema.stdout).properties.schemaVersion.const, '1.0');
  assert.equal(cli('validate', 'examples/comparison.json').status, 0);
});
test('build uses config overrides, exposes actual decisions on stderr, and preserves output after all input failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-cli-'));
  const output = join(directory, 'nested', 'report.html');
  const result = cli(
    'build',
    'examples/comparison.json',
    '--config',
    'examples/presentation.json',
    '--explain',
    '-o',
    output,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /"selected": "comparison.cards"/);
  assert.match(readFileSync(output, 'utf8'), /data-variant="comparison.cards"/);
  const previous = readFileSync(output);
  const invalid = join(directory, 'invalid.json');
  writeFileSync(invalid, '{}');
  const override = join(directory, 'override.json');
  writeFileSync(
    override,
    JSON.stringify({ overrides: { absent: 'comparison.cards' } }),
  );
  for (const args of [
    ['build', invalid, '-o', output],
    ['build', 'examples/comparison.json', '--config', override, '-o', output],
    [
      'build',
      'examples/comparison.json',
      '--unknown-interactive',
      '-o',
      output,
    ],
    ['build', 'examples/comparison.json', '--layout', 'unknown', '-o', output],
  ]) {
    const failed = cli(...args);
    assert.equal(failed.status, 2, failed.stderr);
    assert.deepEqual(readFileSync(output), previous);
  }
  assert.equal(
    cli('validate', 'examples/comparison.json', '--config', override).status,
    2,
  );
});
test('CLI arguments and configuration are strict; diagnostics identify file and JSON path; I/O has code 1', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-cli-'));
  const input = join(directory, 'bad.json');
  const data = comparisonDocument();
  data.sections[0].blocks[0].items[0].attributes.extra = 5;
  writeFileSync(input, JSON.stringify(data));
  const failed = cli('validate', input);
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /bad.json/);
  assert.match(
    failed.stderr,
    /\/sections\/0\/blocks\/0\/items\/0\/attributes\/extra/,
  );
  const config = join(directory, 'config.json');
  writeFileSync(config, '{"interactive":"false"}');
  assert.equal(cli('schema', '--config', config).status, 2);
  assert.equal(cli('schema', 'unexpected').status, 2);
  assert.equal(
    cli('validate', 'examples/comparison.json', '--explain').status,
    2,
  );
  assert.equal(cli('validate', join(directory, 'missing.json')).status, 1);
  assert.equal(cli('build', input, '-o', input).status, 2);
});
test('CLI overrides config values after validating config and does not rewrite the input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-cli-'));
  const config = join(directory, 'config.json');
  writeFileSync(config, '{"theme":"editorial","layout":"sidebar"}');
  const output = join(directory, 'report.html');
  assert.equal(
    cli(
      'build',
      'examples/cards.json',
      '--config',
      config,
      '--theme',
      'minimal',
      '--layout',
      'document',
      '-o',
      output,
    ).status,
    0,
  );
  assert.match(
    readFileSync(output, 'utf8'),
    /data-theme="minimal"\s+data-layout="document"/,
  );
  writeFileSync(config, '{"theme":"unknown"}');
  assert.equal(
    cli(
      'build',
      'examples/cards.json',
      '--config',
      config,
      '--theme',
      'minimal',
      '-o',
      output,
    ).status,
    2,
  );
});

test('richtext CLI exports its schema, matches library output and preserves old output on inline failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-richtext-cli-'));
  const output = join(directory, 'report.html');
  const inputFile = join(directory, 'report.json');
  const config = join(directory, 'presentation.json');
  const example = JSON.parse(readFileSync('examples/richtext.json', 'utf8'));
  writeFileSync(inputFile, JSON.stringify(example));
  writeFileSync(
    config,
    JSON.stringify({ overrides: { 'rich-content': 'richtext.paragraph' } }),
  );
  const schema = JSON.parse(cli('schema').stdout);
  assert.ok(
    schema.definitions.block.oneOf.some(
      (choice) => choice.properties.kind.const === 'richtext',
    ),
  );
  assert.match(cli('--help').stdout, /timeline, richtext/);
  const valid = cli('validate', inputFile);
  assert.equal(valid.status, 0, valid.stderr);
  const built = cli(
    'build',
    inputFile,
    '--config',
    config,
    '--explain',
    '-o',
    output,
  );
  assert.equal(built.status, 0, built.stderr);
  assert.equal(built.stdout, '');
  assert.match(built.stderr, /"selected": "richtext.paragraph"/);
  assert.match(built.stderr, /"origin": "override"/);
  const previous = readFileSync(output, 'utf8');
  assert.equal(
    previous,
    compile(example, { overrides: { 'rich-content': 'richtext.paragraph' } })
      .html,
  );
  for (const [run, diagnostic] of [
    [{ text: 'link', href: 'javascript:alert(1)' }, /UNSAFE_URL/],
    [{ text: 'link', href: '#missing' }, /INVALID_ANCHOR/],
    [{ text: 'link', href: '#%zz' }, /INVALID_ANCHOR/],
    [{ text: 'x', children: [] }, /SCHEMA_ADDITIONALPROPERTIES/],
  ]) {
    const invalid = structuredClone(example);
    invalid.sections[0].blocks[0].content = [run];
    writeFileSync(inputFile, JSON.stringify(invalid));
    for (const args of [
      ['validate', inputFile],
      ['build', inputFile, '-o', output],
    ]) {
      const failure = cli(...args);
      assert.equal(failure.status, 2);
      assert.ok(failure.stderr.includes(inputFile));
      assert.match(failure.stderr, /\/sections\/0\/blocks\/0\/content\/0\//);
      assert.match(failure.stderr, diagnostic);
      assert.equal(readFileSync(output, 'utf8'), previous);
    }
  }
});

test('List/Code CLI builds initial and edited technical guides and reports nested failures without replacing output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-guide-cli-'));
  const inputFile = join(directory, 'guide.json');
  const output = join(directory, 'guide.html');
  const schema = JSON.parse(cli('schema').stdout);
  for (const kind of ['list', 'code'])
    assert.ok(
      schema.definitions.block.oneOf.some(
        (choice) => choice.properties.kind.const === kind,
      ),
    );
  assert.match(cli('--help').stdout, /richtext, list, code/);
  for (const edited of [false, true]) {
    const input = technicalGuide(edited);
    writeFileSync(inputFile, JSON.stringify(input));
    assert.equal(cli('validate', inputFile).status, 0);
    const built = cli('build', inputFile, '--explain', '-o', output);
    assert.equal(built.status, 0, built.stderr);
    assert.equal(built.stdout, '');
    assert.match(built.stderr, /"selected": "list.nested"/);
    assert.match(built.stderr, /"selected": "code.block"/);
    assert.equal(readFileSync(output, 'utf8'), compile(input).html);
  }
  const previous = readFileSync(output);
  for (const [edit, path, code] of [
    [
      (d) => {
        d.sections[0].blocks[1].items[0].children.items[1].content[0].href =
          '#missing';
      },
      '/sections/0/blocks/1/items/0/children/items/1/content/0/href',
      'INVALID_ANCHOR',
    ],
    [
      (d) => {
        d.sections[0].blocks[1].items[0].children.items[1].content[0].href =
          'javascript:alert(1)';
      },
      '/sections/0/blocks/1/items/0/children/items/1/content/0/href',
      'UNSAFE_URL',
    ],
    [
      (d) => {
        d.sections[1].blocks[0].text = 'nul\u0000';
      },
      '/sections/1/blocks/0/text',
      'SCHEMA_PATTERN',
    ],
  ]) {
    const invalid = technicalGuide(true);
    edit(invalid);
    writeFileSync(inputFile, JSON.stringify(invalid));
    for (const args of [
      ['validate', inputFile],
      ['build', inputFile, '-o', output],
    ]) {
      const failed = cli(...args);
      assert.equal(failed.status, 2, failed.stderr);
      assert.ok(failed.stderr.includes(inputFile));
      assert.ok(failed.stderr.includes(path));
      assert.ok(failed.stderr.includes(code));
      assert.deepEqual(readFileSync(output), previous);
    }
  }
});

test('Hierarchy CLI builds initial/edit tree and mindmap through the same schema and preserves output on failure', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-hierarchy-cli-'));
  const inputFile = join(directory, 'hierarchy.json');
  const outputFile = join(directory, 'hierarchy.html');
  const raw = JSON.parse(
    readFileSync('examples/hierarchy-mindmap.json', 'utf8'),
  );
  const config = {
    ...raw,
    themes: raw.themes.map((p) => join(root, 'examples', p)),
    layouts: raw.layouts.map((p) => join(root, 'examples', p)),
  };
  const catalog = await loadPresentation(parseConfig(config));
  const configFile = join(directory, 'presentation.json');
  const schema = JSON.parse(cli('schema').stdout);
  assert.ok(
    schema.definitions.block.oneOf.some(
      (choice) => choice.properties.kind.const === 'hierarchy',
    ),
  );
  assert.match(cli('--help').stdout, /code, hierarchy/);
  for (const variant of ['hierarchy.tree', 'hierarchy.mindmap']) {
    config.overrides['architecture-map'] = variant;
    writeFileSync(configFile, JSON.stringify(config));
    for (const edited of [false, true]) {
      const input = hierarchyDocument(edited);
      writeFileSync(inputFile, JSON.stringify(input));
      assert.equal(
        cli('validate', inputFile, '--config', configFile).status,
        0,
      );
      const built = cli(
        'build',
        inputFile,
        '--config',
        configFile,
        '--explain',
        '-o',
        outputFile,
      );
      assert.equal(built.status, 0, built.stderr);
      assert.ok(built.stderr.includes(`"selected": "${variant}"`));
      assert.equal(
        readFileSync(outputFile, 'utf8'),
        compile(input, config, undefined, catalog).html,
      );
    }
  }
  const previous = readFileSync(outputFile);
  const invalid = hierarchyDocument();
  invalid.sections[0].blocks[1].root.children[0].label = '';
  writeFileSync(inputFile, JSON.stringify(invalid));
  for (const args of [
    ['validate', inputFile],
    ['build', inputFile, '-o', outputFile],
  ]) {
    const failed = cli(...args);
    assert.equal(failed.status, 2);
    assert.ok(failed.stderr.includes(inputFile));
    assert.ok(
      failed.stderr.includes('/sections/0/blocks/1/root/children/0/label'),
    );
    assert.deepEqual(readFileSync(outputFile), previous);
  }
});
