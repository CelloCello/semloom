import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Ajv } from 'ajv';
import {
  createRegistry,
  documentSchema,
  resolveDocument,
  compile,
  SemloomError,
} from '../dist/index.js';
import { runCli } from './cli-helpers.mjs';
import { svgFragment } from '../dist/node/svg.js';
import {
  chartBlock,
  diagramBlock,
  diagramSources,
  visualDocument,
  fixedDomainCases,
} from './fixtures/charts-diagrams.mjs';

const registry = createRegistry();
const structural = new Ajv({ strict: true, strictNumbers: true }).compile(
  documentSchema(registry),
);
const location = '/sections/0/blocks/0';
function rejects(block, code, field) {
  assert.throws(
    () => resolveDocument(visualDocument([block]), registry),
    (e) => {
      assert.ok(e instanceof SemloomError);
      assert.equal(e.diagnostics[0].code, code);
      assert.equal(e.diagnostics[0].path, location + field);
      return true;
    },
  );
}
test('portable schema accepts shapes; shared semantics enforce chart alignment, identity and numerical meaning', () => {
  const valid = visualDocument();
  assert.equal(structural(valid), true);
  const copy = structuredClone(valid);
  resolveDocument(valid, registry);
  assert.deepEqual(valid, copy);
  for (const [block, code, field] of [
    [
      chartBlock({ series: [{ key: 's', label: 'S', values: [1] }] }),
      'CHART_VALUES_LENGTH',
      '/series/0/values',
    ],
    [
      chartBlock({
        categories: [
          { key: 'a', label: 'A' },
          { key: 'a', label: 'B' },
        ],
      }),
      'CHART_DUPLICATE_KEY',
      '/categories/1/key',
    ],
    [
      chartBlock({ series: [chartBlock().series[0], chartBlock().series[0]] }),
      'CHART_DUPLICATE_KEY',
      '/series/1/key',
    ],
    [
      chartBlock({ chartType: 'line', orientation: 'horizontal' }),
      'CHART_ORIENTATION',
      '/orientation',
    ],
    [
      chartBlock({
        series: [{ key: 's', label: 'S', values: [null, null, null] }],
      }),
      'CHART_NO_VALUES',
      '/series',
    ],
    [
      chartBlock({
        chartType: 'donut',
        series: [{ key: 's', label: 'S', values: [1, null, 0] }],
      }),
      'CHART_DONUT_VALUE',
      '/series/0/values/1',
    ],
    [
      chartBlock({
        chartType: 'donut',
        series: [{ key: 's', label: 'S', values: [0, 0, 0] }],
      }),
      'CHART_DONUT_TOTAL',
      '/series/0/values',
    ],
    [
      chartBlock({
        chartType: 'donut',
        series: [
          {
            key: 's',
            label: 'S',
            values: [Number.MAX_VALUE, Number.MAX_VALUE, 0],
          },
        ],
      }),
      'CHART_DONUT_TOTAL',
      '/series/0/values',
    ],
  ]) {
    assert.equal(structural(visualDocument([block])), true);
    rejects(block, code, field);
  }
  for (const values of [
    [0, 0, 0],
    [-1, 0, null],
  ])
    resolveDocument(
      visualDocument([
        chartBlock({ series: [{ key: 's', label: 'S', values }] }),
      ]),
      registry,
    );
  assert.equal(
    structural(
      visualDocument([
        chartBlock({
          series: [{ key: 's', label: 'S', values: [Infinity, 0, 1] }],
        }),
      ]),
    ),
    false,
  );
  for (const extra of [
    { option: {} },
    { chartType: 'pie' },
    { categories: [] },
  ])
    assert.equal(structural(visualDocument([chartBlock(extra)])), false);
});

test('Pele validates all five types, exact source, restricted constructs and ordinary label words', () => {
  for (const source of Object.values(diagramSources))
    resolveDocument(visualDocument([diagramBlock(source)]), registry);
  for (const source of [
    'flowchart LR\n A["style classDef click linkStyle"] --> B',
    'flowchart LR\n A["icon: component; fa: probability"] --> B',
    'flowchart LR\n A["click &quot;style&quot;"] --> B\n %% classDef is a comment',
    'flowchart LR; A[style] --> B[click];\n %% style A fill:red\n B-->C',
    'sequenceDiagram\n A->>B: style classDef click',
    'sequenceDiagram\n box Group\n participant A\n end\n A->>B: hi',
    "flowchart LR\r\n A[Bob's report] --> B\r\n",
  ]) {
    const doc = visualDocument([diagramBlock(source)]);
    assert.equal(resolveDocument(doc, registry).blocks[0].data.source, source);
  }
  for (const source of [
    '%%{init: {}}%%\nflowchart LR\n A-->B',
    '%%{}%%\nflowchart LR\n A-->B',
    '---\n---\nflowchart LR\n A-->B',
    '---\ntitle: Title\n---\nflowchart LR\n A-->B',
    'flowchart LR\n A["%%{init: {}}%%"] --> B',
    'flowchart LR\n %% comment %%{init: {}}%%\n A-->B',
    'flowchart LR; A-->B; style A fill:red',
    'flowchart LR\n A-->B\n classDef red fill:red',
    'flowchart LR\n A-->B\n linkStyle 0 stroke:red',
    'flowchart LR\n A-->B\n click A "https://example.com"',
    'flowchart LR\n A:::red --> B',
    'flowchart LR\n A["<b>HTML</b>"] --> B',
    'flowchart LR\n A["$$x^2$$"] --> B',
    'flowchart LR\n A@{ icon: "mdi:home" }',
    'flowchart LR\n A["fa:fa-home Home"] --> B',
    'sequenceDiagram\n A->>B: hi\n link A: Website @ https://example.com',
    'classDiagram\n class A\n style A fill:red',
    'erDiagram\n A ||--o{ B : owns\n style A fill:red',
    'stateDiagram-v2\n A-->B\n classDef red fill:red',
  ])
    rejects(diagramBlock(source), 'DIAGRAM_RESTRICTED', '/source');
  for (const source of [
    'flowchart LR\n this is invalid',
    'sequenceDiagram\n A???B',
    'classDiagram\n ??',
    'erDiagram\n ??',
    'stateDiagram-v2\n A -->',
  ]) {
    assert.equal(structural(visualDocument([diagramBlock(source)])), true);
    rejects(diagramBlock(source), 'DIAGRAM_SYNTAX', '/source');
  }
  rejects(diagramBlock('pie\n "A": 1'), 'DIAGRAM_TYPE', '/source');
  for (const source of ['\u0000', '\ud800'])
    assert.equal(structural(visualDocument([diagramBlock(source)])), false);
});

test('Mermaid command-like identifiers remain legal across supported diagram types and CLI entry points', async () => {
  const sources = [
    'flowchart LR\n rect --> link --> properties',
    'erDiagram\n rect {\n int id\n }\n rect ||--o{ properties : link',
    'stateDiagram-v2\n rect --> link\n link --> properties',
    'sequenceDiagram\n participant link\n participant properties\n link ->> properties: message',
    'classDiagram\n class Rect\n class Properties\n Rect --> Properties',
  ];
  const document = visualDocument(
    sources.map((source) => diagramBlock(source)),
  );
  assert.equal(structural(document), true);
  const copy = structuredClone(document);
  assert.deepEqual(compile(document).document.data, copy);
  assert.deepEqual(document, copy);
  const directory = await mkdtemp(
    join(tmpdir(), 'semloom-mermaid-identifiers-'),
  );
  try {
    const input = join(directory, 'input.json'),
      output = join(directory, 'output.html');
    await writeFile(input, JSON.stringify(document));
    for (const args of [
      ['validate', input],
      ['build', input, '-o', output],
    ]) {
      const result = await runCli(args);
      assert.equal(result.status, 0, result.stderr);
    }
    assert.ok((await readFile(output, 'utf8')).includes('properties'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  for (const source of [
    'flowchart LR\n A-->B; click A "https://example.com"',
    'sequenceDiagram\n participant A\n links A: {"Website":"https://example.com"}',
    'sequenceDiagram\n participant A\n properties A: {"color":"red"}',
    'sequenceDiagram\n rect rgb(255,0,0)\n A->>B: message\n end',
  ])
    rejects(diagramBlock(source), 'DIAGRAM_RESTRICTED', '/source');
});

test('Mermaid member bodies and shape labels retain command-like text without hiding real directives', async () => {
  const sources = [
    'erDiagram\n A {\n style name\n classDef value\n }',
    'erDiagram\n subgraph G\n A {\n style name\n }\n end',
    'erDiagram\n "Some Entity" {\n style name\n }',
    'erDiagram\n A["Alias with spaces"] {\n style name\n }',
    'classDiagram\n class A {\n link property\n style field\n click()\n }',
    'classDiagram\n namespace G {\n class A {\n link property\n }\n }',
    'classDiagram\n class A["Alias with spaces"] {\n link property\n }',
    'flowchart LR\n A{hello; click here} --> B',
    'flowchart LR\n A{{hello; style guide}} --> B',
    'flowchart LR\n A{hello\n classDef example} --> B',
    'flowchart LR\n A["Opening { literal"] --> B',
    'flowchart LR\n A>hello; click here] --> B',
    'flowchart LR\n A[/hello; click here/] --> B',
    'flowchart LR\n A[(hello; click here)] --> B',
    'flowchart LR\n A(((hello; click here))) --> B',
  ];
  const document = visualDocument(sources.map((s) => diagramBlock(s)));
  assert.equal(structural(document), true);
  const copy = structuredClone(document);
  assert.deepEqual(resolveDocument(document, registry).data, copy);
  assert.deepEqual(compile(document).document.data, copy);
  assert.deepEqual(document, copy);
  const directory = await mkdtemp(join(tmpdir(), 'semloom-member-labels-'));
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify(document));
    for (const args of [
      ['validate', input],
      ['build', input, '-o', join(directory, 'output.html')],
    ]) {
      const result = await runCli(args);
      assert.equal(result.status, 0, result.stderr);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  for (const source of [
    'flowchart LR\n A{hello; click here} --> B; style B fill:red',
    'flowchart LR\n subgraph G\n A{hello; click here}\n click A "https://example.com"\n end',
    'classDiagram\n class A { link property }\n style A fill:red',
    'classDiagram\n namespace G {\n class A { link property }\n }\n classDef red fill:red',
    'erDiagram\n A {\n style name\n }\n style A fill:red',
    'erDiagram\n subgraph G\n A {\n style name\n }\n style A fill:red\n end',
    'erDiagram\n A||--o{B : owns\n style A fill:red',
    'flowchart LR\n A["Opening { literal"] --> B; style missing fill:red',
    'flowchart LR\n A>hello; click here] --> B; style missing fill:red',
  ])
    rejects(diagramBlock(source), 'DIAGRAM_RESTRICTED', '/source');
});

test('Mermaid edge labels preserve command-like words across pipe and inline link syntaxes', async () => {
  const edges = [
    'A -->|hello; click here| B',
    'A -->|hello\n style guide| B',
    'A--hello; click here-->B',
    'A -- open; click here --> B',
    'A -- xray; click here --> B',
    'A -- hello; click here --- B',
    'A == hello; click here ==> B',
    'A -. hello; click here .-> B',
    'A -- hello; click here --o B',
    'A -- hello; click here --x B',
    'A -- hello\n style guide --> B',
    'A==hello; click here==>B',
    'A-.hello; click here.->B',
  ];
  const document = visualDocument(
    edges.map((edge) => diagramBlock('flowchart LR\n' + edge)),
  );
  const copy = structuredClone(document);
  assert.deepEqual(resolveDocument(document, registry).data, copy);
  assert.deepEqual(compile(document).document.data, copy);
  assert.deepEqual(document, copy);
  const directory = await mkdtemp(join(tmpdir(), 'semloom-edge-labels-'));
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify(document));
    for (const args of [
      ['validate', input],
      ['build', input, '-o', join(directory, 'out.html')],
    ]) {
      const result = await runCli(args);
      assert.equal(result.status, 0, result.stderr);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  for (const edge of edges)
    for (const separator of ['; ', '\n'])
      rejects(
        diagramBlock(
          'flowchart LR\n' + edge + separator + 'style missing fill:red',
        ),
        'DIAGRAM_RESTRICTED',
        '/source',
      );
});

test('unlabelled link operators never hide subsequent restricted statements', () => {
  for (const edge of [
    'A---B',
    'A===B',
    'A--oB',
    'A--xB',
    'A-.->B',
    'A-->B-->C',
    'A-...->B',
    'A---->B',
    'A====>B',
  ]) {
    resolveDocument(
      visualDocument([diagramBlock('flowchart LR\n' + edge)]),
      registry,
    );
    rejects(
      diagramBlock('flowchart LR\n' + edge + '; style missing fill:red'),
      'DIAGRAM_RESTRICTED',
      '/source',
    );
  }
});

test('sequence notes consume one event each at the shared 200-event validation boundary', async () => {
  const source = (messages, notes) =>
    'sequenceDiagram\n participant A\n participant B\n' +
    [
      ...Array(messages).fill('A->>B: message'),
      ...Array(notes).fill('Note over A: note'),
    ].join('\n');
  const directory = await mkdtemp(join(tmpdir(), 'semloom-sequence-budget-'));
  try {
    const input = join(directory, 'input.json');
    for (const [messages, notes, valid] of [
      [199, 1, true],
      [200, 1, false],
      [0, 200, true],
      [0, 201, false],
    ]) {
      const block = diagramBlock(source(messages, notes));
      const document = visualDocument([block]);
      assert.equal(structural(document), true);
      if (valid)
        assert.deepEqual(resolveDocument(document, registry).data, document);
      else rejects(block, 'DIAGRAM_LIMIT', '/source');
      await writeFile(input, JSON.stringify(document));
      const result = await runCli(['validate', input]);
      assert.equal(result.status, valid ? 0 : 2, result.stderr);
      if (!valid) assert.match(result.stderr, /DIAGRAM_LIMIT/u);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('per-model and document budgets include nested states and preserve error-state isolation', () => {
  const state =
    'stateDiagram-v2\n state Group {\n' +
    Array.from({ length: 101 }, (_, i) => `state S${i}`).join('\n') +
    '\n }';
  for (const source of [
    'flowchart LR\n' +
      Array.from({ length: 101 }, (_, i) => `A${i}`).join('\n'),
    'sequenceDiagram\n' +
      Array.from({ length: 101 }, (_, i) => `participant A${i}`).join('\n'),
    'classDiagram\n' +
      Array.from({ length: 101 }, (_, i) => `class A${i}`).join('\n'),
    'erDiagram\n' +
      Array.from({ length: 101 }, (_, i) => `A${i} {\n int id\n }`).join('\n'),
    state,
  ])
    rejects(diagramBlock(source), 'DIAGRAM_LIMIT', '/source');
  const large = chartBlock({
    categories: Array.from({ length: 100 }, (_, i) => ({
      key: String(i),
      label: String(i),
    })),
    series: Array.from({ length: 6 }, (_, i) => ({
      key: String(i),
      label: String(i),
      values: Array(100).fill(i),
    })),
  });
  assert.throws(
    () => resolveDocument(visualDocument(Array(6).fill(large)), registry),
    /CHART_DOCUMENT_LIMIT/u,
  );
  const source = 'flowchart LR\n A["' + '文'.repeat(9900) + '"]';
  assert.throws(
    () =>
      resolveDocument(
        visualDocument(Array(6).fill(diagramBlock(source))),
        registry,
      ),
    /DIAGRAM_DOCUMENT_LIMIT/u,
  );
  assert.ok(resolveDocument(visualDocument(), registry));
});

test('CLI schema and shared semantic diagnostics agree; failed build preserves old file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'semloom-visuals-'));
  try {
    const schema = await runCli(['schema']);
    assert.equal(schema.status, 0);
    assert.deepEqual(JSON.parse(schema.stdout), documentSchema(registry));
    const file = join(dir, 'input.json'),
      output = join(dir, 'report.html');
    await writeFile(output, 'original');
    for (const block of [
      chartBlock({ series: [{ key: 's', label: 'S', values: [1] }] }),
      diagramBlock('flowchart LR\n invalid syntax'),
    ]) {
      const doc = visualDocument([block]);
      assert.equal(structural(doc), true);
      let diagnostic;
      try {
        compile(doc);
      } catch (e) {
        diagnostic = e.diagnostics[0];
      }
      await writeFile(file, JSON.stringify(doc));
      for (const args of [
        ['validate', file],
        ['build', file, '-o', output],
      ]) {
        const result = await runCli(args);
        assert.equal(result.status, 2, result.stderr);
        assert.ok(result.stderr.includes(diagnostic.code));
        assert.ok(result.stderr.includes(diagnostic.path));
      }
      assert.equal(await readFile(output, 'utf8'), 'original');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('static vector output is deterministic across repeated, interleaved and fresh-process compilation, with Core identities', () => {
  const chart = chartBlock(),
    diagram = diagramBlock();
  const doc = visualDocument([
    chart,
    structuredClone(chart),
    diagram,
    structuredClone(diagram),
  ]);
  const original = structuredClone(doc);
  const result = compile(doc);
  assert.deepEqual(doc, original);
  assert.deepEqual(result.document.data, original);
  assert.ok(result.document.blocks.every((b) => b.data.id === undefined));
  const ids = [
    ...result.html.matchAll(/<(?:[a-z][\w-]*)\b[^>]*\sid="([^"]*)"/giu),
  ].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  compile(visualDocument([diagramBlock(diagramSources.er)]));
  assert.equal(compile(doc).html, result.html);
  const fresh = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {compile} from './dist/index.js';process.stdout.write(compile(JSON.parse(process.env.SEMLOOM_TEST_DOCUMENT)).html);`,
    ],
    {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, SEMLOOM_TEST_DOCUMENT: JSON.stringify(doc) },
      encoding: 'utf8',
      maxBuffer: 2_000_000,
    },
  );
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.equal(fresh.stdout, result.html);
  const midnight = compile(doc, { theme: 'midnight' });
  assert.deepEqual(midnight.document, result.document);
  assert.deepEqual(midnight.plan, result.plan);
  const main = (html) =>
    html.slice(html.indexOf('<main '), html.indexOf('</main>'));
  assert.equal(main(midnight.html), main(result.html));
  assert.throws(
    () =>
      registry
        .variant('chart', 'chart.static')
        .render(chart, { headingLevel: 3, locale: 'en', layout: 'document' }),
    /RENDER_ID_REQUIRED/u,
  );
});

test('all static chart families and diagram models render with controlled SVG and complete source/data', () => {
  for (const block of [
    chartBlock(),
    chartBlock({ orientation: 'horizontal' }),
    chartBlock({ chartType: 'line' }),
    chartBlock({
      chartType: 'donut',
      series: [{ key: 's', label: 'Value', values: [10, 0, 20] }],
    }),
    ...Object.values(diagramSources).map((s) => diagramBlock(s)),
  ]) {
    const input = { ...block, id: 'static' };
    const result = compile(
      visualDocument([input]),
      block.kind === 'chart' ? { overrides: { static: 'chart.static' } } : {},
    );
    assert.ok(result.html.includes('<svg'));
    assert.ok(!result.html.includes('NaN'));
    assert.ok(!result.html.includes('semloom-key-'));
    assert.ok(!result.html.includes('data-semloom-charts'));
    if (block.kind === 'chart')
      assert.ok(result.html.includes('semloom-chart-table'));
    else assert.ok(result.html.includes('semloom-diagram-source'));
  }
  const hostile = chartBlock({
    title: '</script><img src="https://evil.test">',
    categories: [
      { key: 'a', label: 'id="fake" <script>' },
      { key: 'b', label: 'url(#fake)' },
      { key: 'c', label: 'var(--ink)' },
    ],
  });
  assert.ok(
    compile(visualDocument([hostile])).html.includes('&lt;/script&gt;'),
  );
});

test('ECharts enhancement is independent of switching and only selected chart.svg contributes a single offline runtime with exact CSP and notices', () => {
  const blocks = [
    chartBlock({ id: 'a' }),
    chartBlock({ id: 'b', chartType: 'line' }),
  ];
  const output = compile(visualDocument(blocks), { interactive: false }).html;
  assert.equal(
    (output.match(/<script data-semloom-charts>/gu) ?? []).length,
    1,
  );
  assert.ok(!output.includes('data-semloom-interactive'));
  const script = /<script data-semloom-charts>([\s\S]*?)<\/script>/u.exec(
    output,
  )[1];
  assert.ok(
    output.includes(
      `sha256-${createHash('sha256').update(script).digest('base64')}`,
    ),
  );
  const payload = JSON.parse(
    /id="semloom-chart-data">([\s\S]*?)<\/script>/u.exec(output)[1],
  );
  assert.deepEqual(
    payload.blocks.map((b) => b.id),
    ['a', 'b'],
  );
  assert.ok(payload.licenses.includes('echarts@6.1.0'));
  assert.ok(payload.licenses.includes('Apache License'));
  assert.ok(payload.licenses.includes('zrender@'));
  assert.ok(Buffer.byteLength(output) < 750 * 1024);
  for (const html of [
    compile(visualDocument(blocks), {
      overrides: { a: 'chart.static', b: 'chart.static' },
    }).html,
    compile(visualDocument([diagramBlock()])).html,
  ]) {
    assert.ok(!html.includes('data-semloom-charts'));
    assert.ok(!html.includes('semloom-chart-data'));
    assert.ok(!html.includes('echarts@6.1.0'));
  }
  const hostile = compile(
    visualDocument([
      chartBlock({ title: '</script><img src="https://evil.test">' }),
    ]),
  ).html;
  assert.ok(!hostile.includes('<img src="https://evil.test">'));
});

test('bar print panels cover categories once in order, with full-data domains and stable references', () => {
  const categories = Array.from({ length: 100 }, (_, i) => ({
    key: String(i),
    label: `第${i + 1}項文件匯入格式整理與驗證作業`,
  }));
  const series = Array.from({ length: 6 }, (_, i) => ({
    key: String(i),
    label: `數列${i + 1}`,
    values: categories.map((_, j) =>
      j % 4 === 0 ? null : j % 3 === 0 ? -j : j * i,
    ),
  }));
  for (const orientation of ['horizontal', 'vertical']) {
    const result = compile(
      visualDocument([chartBlock({ categories, series, orientation })]),
    );
    const panels = [
      ...result.html.matchAll(
        /class="semloom-print-panel"\s+data-start="(\d+)"\s+data-end="(\d+)"\s+data-domain="([^"]*)"/gu,
      ),
    ];
    assert.equal(panels[0][1], '0');
    assert.equal(panels.at(-1)[2], '100');
    assert.equal(new Set(panels.map((p) => p[3])).size, 1);
    for (let i = 1; i < panels.length; i++)
      assert.equal(panels[i][1], panels[i - 1][2]);
  }
  const tooLong = chartBlock({
    categories: [{ key: 'x', label: '文'.repeat(200) }],
    series: [{ key: 's', label: 'S', values: [1] }],
  });
  assert.throws(
    () => compile(visualDocument([tooLong])),
    (e) =>
      e.diagnostics[0].code === 'CHART_LAYOUT_LIMIT' &&
      e.diagnostics[0].path === location + '/categories',
  );
});

test('finite extremes retain raw values while normalized coordinates avoid engine overflow', () => {
  for (const chartType of ['bar', 'line'])
    for (const values of [
      [-Number.MAX_VALUE, 0, Number.MAX_VALUE],
      [Number.MIN_VALUE, null, 2 * Number.MIN_VALUE],
    ]) {
      const block = chartBlock({
        id: 'extreme',
        chartType,
        series: [{ key: 's', label: 'S', values }],
      });
      const result = compile(visualDocument([block]), {
        overrides: { extreme: 'chart.static' },
      });
      assert.ok(!result.html.includes('NaN'));
      assert.ok(!result.html.includes('Infinity'));
      assert.ok(result.html.includes(String(values[0])));
      assert.deepEqual(result.document.blocks[0].data.series[0].values, values);
    }
});

test('actual SSR value ticks distinguish close decimal and large values at every layout', () => {
  for (const values of [
    [1.000001, 1.000002, 1.000003],
    [1000000, 1000100, 1000200],
    [-1000200, -1000100, -1000000],
    [0.000001000001, 0.000001000002, 0.000001000003],
  ]) {
    const document = visualDocument([
      chartBlock({
        id: 'precise',
        chartType: 'line',
        categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
        series: [{ key: 's', label: 'S', values }],
      }),
    ]);
    const result = compile(document, {
      overrides: { precise: 'chart.static' },
    });
    assert.deepEqual(result.document.data, document);
    const svgs = [...result.html.matchAll(/<svg\b[\s\S]*?<\/svg>/gu)];
    assert.equal(svgs.length, 3);
    for (const [svg] of svgs) {
      const ticks = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/gu)]
        .map((m) => m[1])
        .filter((text) => Number.isFinite(Number(text)));
      assert.ok(ticks.length >= 2, svg);
      assert.equal(new Set(ticks).size, ticks.length, `${values}: ${ticks}`);
      const numbers = ticks.map(Number);
      assert.ok(
        numbers.every((v, i) => i === 0 || v > numbers[i - 1]),
        String(ticks),
      );
      assert.ok(
        numbers[0] <= Math.min(...values) &&
          numbers.at(-1) >= Math.max(...values),
        String(ticks),
      );
    }
  }
});

test('subnormal value ticks retain distinct mathematical values in every SSR layout', () => {
  for (const chartType of ['line', 'bar'])
    for (const orientation of chartType === 'bar'
      ? ['vertical', 'horizontal']
      : [undefined])
      for (const values of [
        [Number.MIN_VALUE, null, 2 * Number.MIN_VALUE],
        [-2 * Number.MIN_VALUE, null, -Number.MIN_VALUE],
        [-Number.MIN_VALUE, null, Number.MIN_VALUE],
        [Number.MIN_VALUE, null, 20 * Number.MIN_VALUE],
        [2 ** -1022 - Number.MIN_VALUE, null, 2 ** -1022 + Number.MIN_VALUE],
      ]) {
        const document = visualDocument([
          chartBlock({
            id: 'subnormal',
            chartType,
            ...(orientation ? { orientation } : {}),
            categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
            series: [{ key: 's', label: 'S', values }],
          }),
        ]);
        const output = compile(document, {
          overrides: { subnormal: 'chart.static' },
        });
        assert.deepEqual(output.document.data, document);
        const svgs = [...output.html.matchAll(/<svg\b[\s\S]*?<\/svg>/gu)];
        assert.equal(svgs.length, 3);
        for (const [svg] of svgs) {
          const ticks = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/gu)]
            .map((m) => m[1])
            .filter((t) => !['A', 'B', 'C'].includes(t));
          assert.ok(ticks.length >= 2);
          assert.equal(new Set(ticks).size, ticks.length, String(ticks));
          // Compare printed decimal values exactly in units of 1e-340, without
          // rounding them back to JavaScript Numbers near subnormal boundaries.
          const units = ticks.map((t) => {
            const [mantissa, exponent = '0'] = t.split('e');
            const decimals = mantissa.split('.')[1]?.length ?? 0;
            return (
              BigInt(mantissa.replace('.', '')) *
              10n ** BigInt(Number(exponent) + 340 - decimals)
            );
          });
          assert.ok(
            units.every((v, i) => i === 0 || v > units[i - 1]),
            String(ticks),
          );
        }
      }
});

test('close fixed domains compile across signs and scales without changing authored values', async () => {
  const blocks = [
    [1.23456789, 1.234568, 1.2345681],
    [3.7, 3.70000037, 3.70000074],
    [7.000000000000003e-309, 7.0000007e-309, 7.0000014e-309],
    [7.000000000000003e-309, 7.000000000000013e-309, 7.00000000000002e-309],
  ].flatMap((values, i) =>
    [1, -1].map((sign) =>
      chartBlock({
        id: `fixed-${i}-${sign === 1 ? 'positive' : 'negative'}`,
        chartType: 'line',
        categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
        series: [{ key: 's', label: 'S', values: values.map((v) => sign * v) }],
      }),
    ),
  );
  const document = visualDocument(blocks),
    copy = structuredClone(document);
  assert.deepEqual(resolveDocument(document, registry).data, copy);
  const output = compile(document);
  assert.deepEqual(output.document.data, copy);
  assert.deepEqual(document, copy);
  assert.equal([...output.html.matchAll(/<svg\b/gu)].length, blocks.length * 3);
  const directory = await mkdtemp(join(tmpdir(), 'semloom-fixed-domain-'));
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify(document));
    for (const args of [
      ['validate', input],
      ['build', input, '-o', join(directory, 'out.html')],
    ]) {
      const result = await runCli(args);
      assert.equal(result.status, 0, result.stderr);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fixed domains outside the old precision guard render in both variants and CLI', async () => {
  const blocks = fixedDomainCases.flatMap((values, i) =>
    [1, -1].map((sign) =>
      chartBlock({
        id: `outside-${i}-${sign === 1 ? 'positive' : 'negative'}`,
        chartType: 'line',
        categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
        series: [{ key: 's', label: 'S', values: values.map((v) => v * sign) }],
      }),
    ),
  );
  const document = visualDocument(blocks),
    copy = structuredClone(document);
  assert.deepEqual(resolveDocument(document, registry).data, copy);
  const directory = await mkdtemp(join(tmpdir(), 'semloom-fixed-interval-'));
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify(document));
    for (const variant of ['chart.svg', 'chart.static']) {
      const config = {
        overrides: Object.fromEntries(blocks.map((b) => [b.id, variant])),
      };
      const output = compile(document, config);
      assert.deepEqual(output.document.data, copy);
      const figures = [...output.html.matchAll(/<svg\b[\s\S]*?<\/svg>/gu)];
      assert.equal(figures.length, blocks.length * 3);
      for (const [svg] of figures) {
        const ticks = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/gu)]
          .map((m) => m[1])
          .filter((t) => !['A', 'B', 'C'].includes(t));
        assert.ok(ticks.length >= 2);
        assert.equal(new Set(ticks).size, ticks.length, String(ticks));
        assert.ok(!/NaN|Infinity/u.test(svg));
      }
      const configPath = join(directory, 'config.json'),
        outputPath = join(directory, 'out.html');
      await writeFile(configPath, JSON.stringify(config));
      for (const args of [
        ['validate', input, '--config', configPath],
        ['build', input, '--config', configPath, '-o', outputPath],
      ]) {
        const result = await runCli(args);
        assert.equal(result.status, 0, result.stderr);
      }
      assert.equal(await readFile(outputPath, 'utf8'), output.html);
    }
    assert.deepEqual(document, copy);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('controlled numerical ticks retain a visible zero on crossing domains', () => {
  for (const chartType of ['line', 'bar'])
    for (const orientation of chartType === 'bar'
      ? ['vertical', 'horizontal']
      : [undefined])
      for (const values of [
        [-12, 0, 128],
        [-0.01, 0, 0.1],
        [-Number.MAX_VALUE, 0, Number.MAX_VALUE],
        [-Number.MIN_VALUE, 0, Number.MIN_VALUE],
      ]) {
        const block = chartBlock({
          chartType,
          ...(orientation ? { orientation } : {}),
          categories: ['A', 'B', 'C'].map((label) => ({ key: label, label })),
          series: [{ key: 's', label: 'S', values }],
        });
        const output = compile(visualDocument([block]));
        for (const [svg] of output.html.matchAll(/<svg\b[\s\S]*?<\/svg>/gu))
          assert.match(svg, /<text\b[^>]*>0<\/text>/u);
      }
});

test('unexpected chart engine errors retain the normal renderer failure diagnostic', () => {
  const echarts = createRequire(import.meta.url)('echarts');
  const original = echarts.init;
  echarts.init = () => {
    throw new Error('Injected engine failure.');
  };
  try {
    assert.throws(
      () => compile(visualDocument([chartBlock()])),
      (error) =>
        error instanceof SemloomError &&
        error.diagnostics[0].code === 'RENDER_FAILED' &&
        error.diagnostics[0].path === location,
    );
  } finally {
    echarts.init = original;
  }
});

test('every diagram model enforces the relation/message budget', () => {
  for (const [header, edge] of [
    ['flowchart LR', 'A-->B'],
    ['sequenceDiagram', 'A->>B: message'],
    ['classDiagram', 'A --> B'],
    ['erDiagram', 'A ||--o{ B : owns'],
    ['stateDiagram-v2', 'A --> B'],
  ]) {
    rejects(
      diagramBlock(header + '\n' + Array(201).fill(edge).join('\n')),
      'DIAGRAM_LIMIT',
      '/source',
    );
  }
});

test('controlled SVG boundary validates tags, attributes, CSS and references without replacing text', () => {
  for (const svg of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="x"></svg>',
    '<svg><foreignObject></foreignObject></svg>',
    '<svg><path href="https://evil.test"/></svg>',
    '<svg><path style="fill:url(https://evil.test)"/></svg>',
    '<svg><path clip-path="url(#missing)"/></svg>',
  ])
    assert.throws(() => svgFragment(svg, 'safe'));
  const result = svgFragment(
    '<svg><defs><clipPath id="raw"><rect width="1" height="1"/></clipPath></defs><text>id="raw" url(#raw) #123401</text><path fill="#123401" clip-path="url(#raw)" class="zr99-cls-102"/></svg>',
    'safe',
    new Map([['#123401', 'var(--role)']]),
  ).value;
  assert.ok(result.includes('<text>id="raw" url(#raw) #123401</text>'));
  assert.ok(result.includes('id="safe-0"'));
  assert.ok(result.includes('clip-path="url(#safe-0)"'));
  assert.ok(result.includes('fill="var(--role)"'));
  assert.ok(result.includes('class="safe-cls-0"'));
});

test('semantic grouping, loops and class markers render within the five supported families', () => {
  for (const source of [
    'classDiagram\n class A {\n +foo()$\n }',
    'classDiagram\n class A {\n <<interface>>\n +foo()\n }',
    'sequenceDiagram\n loop Retry\n A->>B: request\n alt valid\n B-->>A: response\n else invalid\n B-->>A: error\n end\n end',
    'flowchart LR\n subgraph G[Group]\n A[Input]-->B[Output]\n end',
    'stateDiagram-v2\n state G {\n [*]-->A\n --\n [*]-->B\n }',
    'flowchart LR\r\n A["icon: component"]-->B\r\n',
  ]) {
    const result = compile(visualDocument([diagramBlock(source)]));
    assert.ok(result.html.includes('<svg'));
    assert.equal(result.document.blocks[0].data.source, source);
    if (source.includes('\r')) assert.ok(result.html.includes('&#13;'));
  }
});

test('build-only layout diagnostics preserve existing CLI output after successful validation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'semloom-layout-'));
  try {
    const file = join(dir, 'input.json'),
      output = join(dir, 'report.html');
    for (const block of [
      chartBlock({
        categories: [{ key: 'a', label: '文'.repeat(200) }],
        series: [{ key: 's', label: 'S', values: [1] }],
      }),
      diagramBlock(
        'flowchart TB\n' +
          Array.from({ length: 99 }, (_, i) => `A${i}-->A${i + 1}`).join('\n'),
      ),
    ]) {
      const document = visualDocument([block]);
      assert.doesNotThrow(() => resolveDocument(document, registry));
      await writeFile(file, JSON.stringify(document));
      await writeFile(output, 'original');
      assert.equal((await runCli(['validate', file])).status, 0);
      const result = await runCli(['build', file, '-o', output]);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /(?:CHART|DIAGRAM)_LAYOUT_LIMIT/u);
      assert.equal(await readFile(output, 'utf8'), 'original');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
