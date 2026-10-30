import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Ajv } from 'ajv';
import { compile, parseConfig, loadPresentation } from '../dist/index.js';
import { reportWorkflows } from './fixtures/report-workflows.mjs';

test('workflow index cannot silently skip a required report or Variant', () => {
  const input = JSON.parse(
    readFileSync(resolve('examples/report-workflows/cases.json'), 'utf8'),
  );
  const directory = mkdtempSync(resolve(tmpdir(), 'semloom-workflow-index-'));
  try {
    for (const edit of [
      () => [],
      (cases) => cases.map((scenario) => ({ ...scenario, variants: [] })),
      (cases) => {
        cases[0].variants.pop();
        return cases;
      },
    ]) {
      writeFileSync(
        resolve(directory, 'cases.json'),
        JSON.stringify(edit(structuredClone(input))),
      );
      assert.throws(
        () => reportWorkflows(directory),
        /Required report workflow cases or Variants/u,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('three report edits change only the requested content and preserve remaining facts, IDs and sources', () => {
  const [tools, guide, architecture] = reportWorkflows();
  const expectedTools = structuredClone(tools.initial);
  const addition = tools.edited.sections[1].blocks[0].items.at(-1);
  assert.equal(addition.name, 'Browser entry');
  assert.deepEqual(Object.keys(addition.attributes), [
    'input',
    'output',
    'use',
  ]);
  expectedTools.sections[1].blocks[0].items.push(addition);
  expectedTools.sections[0].blocks[0].content[0].text =
    '批次交付可選 CLI；需要程式整合可選 Library API；browser entry 則用於離線互動，不作為文件編譯入口。';
  assert.deepEqual(tools.edited, expectedTools);

  const expectedGuide = structuredClone(guide.initial);
  expectedGuide.sections[0].blocks[1].items[0].children.items[1].content[0].text =
    '保留輸入 JSON 與 presentation config，方便後續重建。';
  expectedGuide.sections[1].blocks[0].text =
    expectedGuide.sections[1].blocks[0].text.replace(
      '--explain',
      '--explain --theme midnight',
    );
  assert.deepEqual(guide.edited, expectedGuide);
  assert.match(
    guide.initial.sections[1].blocks[1].text,
    /\r\n  label: "<tag> & value",\r\n\r\n/u,
  );

  const expectedArchitecture = structuredClone(architecture.initial);
  const root = expectedArchitecture.sections[0].blocks[1].root;
  const [theme] = root.children[1].children.splice(0, 1);
  theme.label = 'Theme：可替換的視覺風格';
  root.children[2].children.push(theme);
  assert.deepEqual(architecture.edited, expectedArchitecture);
});

test('shipped workflows validate against effective CLI Schema, retain selection across presentation, and match Library/CLI output', async () => {
  const directory = resolve('reports/workflows/source');
  mkdirSync(directory, { recursive: true });
  const commands = [];
  function cli(args) {
    const result = spawnSync(
      process.execPath,
      [resolve('dist/cli/main.js'), ...args],
      { encoding: 'utf8' },
    );
    commands.push({ args, exitCode: result.status });
    assert.equal(result.status, 0, result.stderr);
    return result;
  }
  for (const scenario of reportWorkflows()) {
    for (const variant of scenario.variants) {
      const catalog = await loadPresentation(
        parseConfig(variant.options),
        dirname(variant.configFile),
      );
      const schema = JSON.parse(
        cli(['schema', '--config', variant.configFile]).stdout,
      );
      const validate = new Ajv({ strict: true }).compile(schema);
      for (const phase of ['initial', 'edited']) {
        const input = scenario[phase],
          original = structuredClone(input);
        assert.equal(validate(input), true, JSON.stringify(validate.errors));
        for (const layout of ['document', 'sidebar', 'example.right-sidebar']) {
          let baseline;
          for (const theme of ['minimal', 'example.paper', 'example.night']) {
            const options = { ...variant.options, theme, layout };
            const output = compile(input, options, undefined, catalog);
            assert.deepEqual(output.document.data, original);
            assert.deepEqual(input, original);
            if (baseline) assert.deepEqual(output.plan, baseline);
            else baseline = output.plan;
            assert.equal(
              output.html,
              compile(input, options, undefined, catalog).html,
            );
            assert.equal(
              output.plan.context.layout,
              layout === 'document' ? 'document' : 'sidebar',
            );
            if (variant.blockId) {
              const selected = output.plan.blocks.find(
                (block) => block.id === variant.blockId,
              );
              assert.equal(selected.selected, variant.selected);
              assert.equal(selected.origin, 'override');
            }
          }
        }
        const theme = phase === 'edited' ? 'example.night' : 'example.paper';
        const options = { ...variant.options, theme };
        const output = compile(input, options, undefined, catalog);
        const args = [
          scenario.inputFiles[phase],
          '--config',
          variant.configFile,
          '--theme',
          theme,
        ];
        cli([
          'validate',
          scenario.inputFiles[phase],
          '--config',
          variant.configFile,
        ]);
        const file = resolve(
          directory,
          `${scenario.id}-${phase}-${variant.id}.html`,
        );
        const result = cli(['build', ...args, '--explain', '-o', file]);
        assert.equal(result.stdout, '');
        const notice = `Built ${file}\n`;
        assert.ok(result.stderr.endsWith(notice));
        const explain = result.stderr.slice(0, -notice.length);
        assert.deepEqual(JSON.parse(explain), output.plan);
        assert.equal(readFileSync(file, 'utf8'), output.html);
        writeFileSync(file.replace(/\.html$/u, '.plan.json'), explain);
      }
    }
  }
  writeFileSync(
    resolve(directory, 'commands.json'),
    JSON.stringify(commands, null, 2) + '\n',
  );
});
