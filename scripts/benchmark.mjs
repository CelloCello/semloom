import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { compile, documentSchema, createRegistry } from '../dist/index.js';
import { loadScenarios } from './scenarios.mjs';
import { gzipSync } from 'node:zlib';
import { cpus, release } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
// A separate fixed visual corpus preserves the original 32 conditions verbatim.
const mixedVisual = JSON.parse(
  await readFile('examples/visual-workflow-initial.json', 'utf8'),
);
const subset = (kinds, count = Infinity) => ({
  ...mixedVisual,
  sections: [
    {
      ...mixedVisual.sections[0],
      blocks: mixedVisual.sections[0].blocks
        .filter((b) => kinds.includes(b.kind))
        .slice(0, count),
    },
  ],
});
const visualProfiles = [
  { id: 'ordinary', document: subset(['prose']), options: {} },
  {
    id: 'chart.static',
    document: subset(['chart'], 1),
    options: { overrides: { comparison: 'chart.static' } },
  },
  { id: 'chart.svg', document: subset(['chart'], 1), options: {} },
  { id: 'diagram-only', document: subset(['diagram'], 1), options: {} },
  { id: 'mixed', document: mixedVisual, options: {} },
];
const visuals = [];
await mkdir('reports/benchmark/visuals', { recursive: true });
for (const profile of visualProfiles) {
  const result = compile(profile.document, profile.options);
  assert.deepEqual(result.document.data, profile.document);
  await writeFile(`reports/benchmark/visuals/${profile.id}.html`, result.html);
  await writeFile(
    `reports/benchmark/visuals/${profile.id}.json`,
    JSON.stringify(profile.document),
  );
  await writeFile(
    `reports/benchmark/visuals/${profile.id}.config.json`,
    JSON.stringify(profile.options),
  );
  const script =
    /<script data-semloom-charts>([\s\S]*?)<\/script>/u.exec(
      result.html,
    )?.[1] ?? '';
  visuals.push({
    id: profile.id,
    htmlBytes: Buffer.byteLength(result.html),
    gzipBytes: gzipSync(result.html).length,
    chartBundleBytes: Buffer.byteLength(script),
    chartBundleGzipBytes: gzipSync(script).length,
    sha256: createHash('sha256').update(result.html).digest('hex'),
    warmCompileMs: [],
    coldCliWallClockMs: [],
    browserReadyMs: [],
    browserAnimationCompleteMs: [],
  });
}
for (let i = 0; i < 21; i++)
  for (const [index, profile] of visualProfiles.entries()) {
    const start = performance.now();
    compile(profile.document, profile.options);
    visuals[index].warmCompileMs.push(performance.now() - start);
  }
for (let i = 0; i < 3; i++)
  for (const [index, profile] of visualProfiles.entries()) {
    const start = performance.now();
    const result = spawnSync(
      process.execPath,
      [
        'dist/cli/main.js',
        'build',
        `reports/benchmark/visuals/${profile.id}.json`,
        '--config',
        `reports/benchmark/visuals/${profile.id}.config.json`,
        '-o',
        `reports/benchmark/visuals/${profile.id}-cli.html`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    visuals[index].coldCliWallClockMs.push(performance.now() - start);
  }
if (process.env.SEMLOOM_BENCHMARK_BROWSER === '1') {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.cache/ms-playwright');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < visuals.length; j++) {
        const index = (i + j) % visuals.length;
        const profile = visuals[index];
        const page = await browser.newPage({
          viewport: { width: 1280, height: 900 },
        });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (/^https?:/u.test(request.url())) errors.push(request.url());
        });
        await page.goto(
          pathToFileURL(resolve(`reports/benchmark/visuals/${profile.id}.html`))
            .href,
        );
        if (profile.chartBundleBytes)
          await page.waitForFunction(
            (count) =>
              document.querySelectorAll('[data-chart-ready]').length === count,
            profile.id === 'mixed' ? 2 : 1,
          );
        const timing = await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          );
          const ready = performance.now();
          await Promise.all(
            document.getAnimations().map((animation) => animation.finished),
          );
          return { ready, complete: performance.now() };
        });
        assert.deepEqual(errors, []);
        profile.browserReadyMs.push(timing.ready);
        profile.browserAnimationCompleteMs.push(timing.complete);
        await page.close();
      }
  } finally {
    await browser.close();
  }
}
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    osRelease: release(),
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
  visuals,
  caveats: [
    'Compile time excludes Agent generation and is not end-to-end task time.',
    'Calls in one process reuse Registry/validators and may reuse bundler state; first samples can be warmed by earlier conditions.',
    'Fixed table and Auto select the same view for this input; no quality gain established.',
    'Visual samples use 21 warm compiles and 3 cold CLI invocations per profile. SEMLOOM_BENCHMARK_BROWSER=1 adds 5 sequential 1280x900 browser opens per profile after Node measurements, rotating profile order; reader-ready and CSS-animation-complete are separate navigation-relative timestamps.',
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
      visualProfiles: visuals.map((v) => ({
        id: v.id,
        htmlBytes: v.htmlBytes,
        gzipBytes: v.gzipBytes,
        warmMedianMs: [...v.warmCompileMs].sort((a, b) => a - b)[10],
      })),
      conditions: rows.map((r) => ({
        condition: r.condition,
        htmlBytes: r.htmlBytes,
      })),
    },
    null,
    2,
  ),
);
