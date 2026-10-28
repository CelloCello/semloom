import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { compile, documentSchema, createRegistry } from '../dist/index.js';
import { loadScenarios } from './scenarios.mjs';

await mkdir('reports/benchmark', { recursive: true });
const source = JSON.parse(
  await readFile('benchmarks/comparison/semantic-initial.json', 'utf8'),
);
const edited = JSON.parse(
  await readFile('benchmarks/comparison/semantic-edited.json', 'utf8'),
);
const rows = [];
for (const [name, document, options] of [
  ['fixed', source, { overrides: { languages: 'comparison.table' } }],
  ['auto', source, {}],
  ['interactive', source, { interactive: true }],
  [
    'interactive-editorial-sidebar',
    source,
    { interactive: true, theme: 'editorial', layout: 'sidebar' },
  ],
  ['fixed-edited', edited, { overrides: { languages: 'comparison.table' } }],
  ['auto-edited', edited, {}],
  ['override-cards', source, { overrides: { languages: 'comparison.cards' } }],
  ['minimal-sidebar', source, { theme: 'minimal', layout: 'sidebar' }],
  ['editorial-document', source, { theme: 'editorial', layout: 'document' }],
  ['editorial-sidebar', source, { theme: 'editorial', layout: 'sidebar' }],
  [
    'editorial-sidebar-fixed',
    source,
    {
      theme: 'editorial',
      layout: 'sidebar',
      overrides: { languages: 'comparison.table' },
    },
  ],
]) {
  const times = [];
  let result;
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    result = compile(document, options);
    times.push(performance.now() - start);
  }
  await writeFile(`reports/benchmark/${name}.html`, result.html);
  rows.push({
    condition: name,
    htmlBytes: Buffer.byteLength(result.html),
    sha256: createHash('sha256').update(result.html).digest('hex'),
    firstCompileMs: times[0],
    subsequentCompileMs: times.slice(1),
    selected: result.plan.blocks.map((b) => ({
      id: b.id,
      selected: b.selected,
    })),
  });
}
for (const name of [
  'direct-initial',
  'direct-edited',
  'direct-editorial-sidebar',
]) {
  const html = await readFile(`benchmarks/comparison/${name}.html`);
  await writeFile(`reports/benchmark/${name}.html`, html);
  rows.push({
    condition: name,
    htmlBytes: html.byteLength,
    sha256: createHash('sha256').update(html).digest('hex'),
    firstCompileMs: null,
    subsequentCompileMs: [],
  });
}
const coldRuns = [];
for (let i = 0; i < 3; i++) {
  const start = performance.now();
  const result = spawnSync(
    process.execPath,
    [
      'dist/cli/main.js',
      'build',
      'benchmarks/comparison/semantic-initial.json',
      '-o',
      'reports/benchmark/cli.html',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  coldRuns.push(performance.now() - start);
}
const scenarios = [];
for (const scenario of loadScenarios()) {
  const directory = `reports/benchmark/scenarios/${scenario.id}`;
  await mkdir(directory, { recursive: true });
  for (const phase of ['initial', 'edited']) {
    for (const condition of ['fixed', 'auto', 'interactive']) {
      const options =
        condition === 'fixed'
          ? { overrides: { [scenario.comparisonId]: 'comparison.table' } }
          : { interactive: condition === 'interactive' };
      const times = [];
      let result;
      for (let i = 0; i < 6; i++) {
        const start = performance.now();
        result = compile(scenario[phase], options);
        times.push(performance.now() - start);
      }
      assert.deepEqual(result.document.data, scenario[phase]);
      assert.equal(
        result.plan.blocks.find((block) => block.id === scenario.comparisonId)
          .selected,
        condition === 'fixed' ? 'comparison.table' : scenario.expectedAuto,
      );
      await writeFile(`${directory}/${phase}-${condition}.html`, result.html);
      scenarios.push({
        scenario: scenario.id,
        phase,
        condition,
        htmlBytes: Buffer.byteLength(result.html),
        sha256: createHash('sha256').update(result.html).digest('hex'),
        firstCompileMs: times[0],
        subsequentCompileMs: times.slice(1),
        selected: result.plan.blocks.map((block) => ({
          id: block.id,
          selected: block.selected,
        })),
      });
    }
  }
}
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    dependencies: JSON.parse(await readFile('package.json', 'utf8'))
      .dependencies,
  },
  schemaBytes: Buffer.byteLength(
    JSON.stringify(documentSchema(createRegistry())),
  ),
  agentGuideBytes: Buffer.byteLength(await readFile('docs/agent-guide.md')),
  semanticInputBytes: Buffer.byteLength(
    await readFile('benchmarks/comparison/semantic-initial.json'),
  ),
  coldCliWallClockMs: coldRuns,
  conditions: rows,
  scenarios,
  caveats: [
    'Compile time excludes Agent generation and is not end-to-end task time.',
    'Subsequent calls reuse the process, not a compiled-validator cache.',
    'Fixed table and Auto select the same view for this input; no quality gain established.',
  ],
};
await writeFile(
  'reports/benchmark/results.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      coldCliWallClockMs: coldRuns.map(Math.round),
      additionalScenarioConditions: scenarios.length,
      conditions: rows.map((r) => ({
        condition: r.condition,
        htmlBytes: r.htmlBytes,
      })),
    },
    null,
    2,
  ),
);
