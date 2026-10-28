import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonDocument } from './helpers.mjs';

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
