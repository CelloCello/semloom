import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv } from 'ajv';
import {
  compile,
  createRegistry,
  documentSchema,
  listLimits,
  codeLimits,
  SemloomError,
} from '../dist/index.js';
import { technicalGuide } from './fixtures/technical-guide.mjs';

const document = (block) => ({
  schemaVersion: '1.0',
  title: 'Content contract',
  sections: [{ title: 'Content', blocks: [block] }],
});
const list = () => ({
  kind: 'list',
  ordered: false,
  items: [{ content: [{ text: 'Item' }] }],
});
const diagnostic = (block, path, code) => {
  assert.throws(
    () => compile(document(block)),
    (error) => {
      assert.ok(error instanceof SemloomError);
      assert.ok(
        error.diagnostics.some(
          (d) => d.path === `/sections/0/blocks/0${path}` && d.code === code,
        ),
        error.message,
      );
      return true;
    },
  );
};
function nestedList(depth) {
  const root = list();
  let group = root;
  for (let i = 1; i < depth; i++) {
    const { ordered, items } = list();
    group.items[0].children = { ordered, items };
    group = group.items[0].children;
  }
  return root;
}

test('List and Code schemas compile alone and within the effective document schema', () => {
  const registry = createRegistry();
  const ajv = new Ajv({ strict: true });
  for (const kind of registry
    .definitions()
    .filter((k) => ['list', 'code'].includes(k.kind))) {
    const validate = ajv.compile(kind.schema);
    const input =
      kind.kind === 'list'
        ? {
            ordered: true,
            items: [
              {
                content: [{ text: 'One' }],
                children: {
                  ordered: false,
                  items: [{ content: [{ text: 'Child' }] }],
                },
              },
            ],
          }
        : { text: '\n\tconst x = `<>&`;\r\n', language: 'js' };
    assert.equal(validate(input), true, JSON.stringify(validate.errors));
  }
  const validate = ajv.compile(documentSchema(registry));
  assert.equal(
    validate(technicalGuide()),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(validate(document(nestedList(listLimits.depth))), true);
  assert.equal(validate(document(nestedList(listLimits.depth + 1))), false);
});

test('mixed ordered/unordered lists preserve nesting, run order, sources and data', () => {
  const input = technicalGuide();
  const original = structuredClone(input);
  const output = compile(input, {
    overrides: {
      'guide-checklist': 'list.nested',
      'build-command': 'code.block',
    },
  });
  assert.deepEqual(input, original);
  assert.deepEqual(output.document.data, original);
  assert.equal(
    output.plan.blocks.find((b) => b.id === 'guide-checklist').selected,
    'list.nested',
  );
  assert.equal(
    output.plan.blocks.find((b) => b.id === 'build-command').origin,
    'override',
  );
  assert.match(
    output.html,
    /<ul class="semloom-list"><li><div class="prose semloom-richtext"><strong>整理內容<\/strong><\/div><ol class="semloom-list">/,
  );
  assert.ok(
    output.html.indexOf('確認 <code>examples/technical-guide.json</code>') <
      output.html.indexOf('保留輸入 JSON'),
  );
  assert.ok(output.html.includes('<a href="#review"><em>生成的 HTML</em></a>'));
  assert.equal((output.html.match(/class="citations"/g) ?? []).length, 4);
  assert.equal(
    output.html,
    compile(input, {
      overrides: {
        'guide-checklist': 'list.nested',
        'build-command': 'code.block',
      },
    }).html,
  );
  const ordered = list();
  ordered.ordered = true;
  assert.ok(
    compile(document(ordered)).html.includes('<ol class="semloom-list">'),
  );
});

test('list structure rejects unknown fields, missing order, empty items and invalid nested runs', () => {
  for (const [edit, path, code] of [
    [
      (b) => {
        delete b.ordered;
      },
      '/ordered',
      'SCHEMA_REQUIRED',
    ],
    [
      (b) => {
        b.ordered = 'false';
      },
      '/ordered',
      'SCHEMA_TYPE',
    ],
    [
      (b) => {
        b.items = [];
      },
      '/items',
      'SCHEMA_MINITEMS',
    ],
    [
      (b) => {
        b.items[0].text = 'unused';
      },
      '/items/0/text',
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
    [
      (b) => {
        b.items[0].children = [];
      },
      '/items/0/children',
      'SCHEMA_TYPE',
    ],
    [
      (b) => {
        b.items[0].content = 'literal';
      },
      '/items/0/content',
      'SCHEMA_TYPE',
    ],
    [
      (b) => {
        b.items[0].content[0].marks = ['bold'];
      },
      '/items/0/content/0/marks/0',
      'SCHEMA_ENUM',
    ],
    [
      (b) => {
        b.items[0].children = {
          ordered: true,
          items: [{ content: [{ text: 'x', html: '<b>x</b>' }] }],
        };
      },
      '/items/0/children/items/0/content/0/html',
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
  ]) {
    const block = list();
    edit(block);
    diagnostic(block, path, code);
  }
});

test('list depth, total item count and per-item inline budgets fail without truncation', () => {
  assert.doesNotThrow(() => compile(document(nestedList(listLimits.depth))));
  diagnostic(
    nestedList(listLimits.depth + 1),
    '/items/0/children'.repeat(listLimits.depth),
    'SCHEMA_ADDITIONALPROPERTIES',
  );
  const block = list();
  block.items = Array.from({ length: listLimits.items }, () => ({
    content: [{ text: 'x' }],
  }));
  assert.doesNotThrow(() => compile(document(block)));
  block.items[0].children = {
    ordered: true,
    items: [{ content: [{ text: 'nested' }] }],
  };
  diagnostic(block, `/items/${listLimits.items - 1}`, 'LIST_LIMIT');
  block.items = [
    {
      content: [{ text: 'x' }],
      children: {
        ordered: false,
        items: [{ content: [{ text: '😀'.repeat(100000) }, { text: 'x' }] }],
      },
    },
  ];
  diagnostic(block, '/items/0/children/items/0/content/1/text', 'INLINE_LIMIT');
});

test('every list level validates links after IDs resolve, using the shared URL and anchor policy', () => {
  const input = technicalGuide();
  const block = input.sections[0].blocks[1];
  for (const href of [
    '#review',
    '#build-command',
    '#semloom-source-cli-guide',
  ]) {
    block.items[0].children.items[0].content[0].href = href;
    assert.doesNotThrow(() => compile(input));
  }
  for (const [href, code] of [
    ['javascript:alert(1)', 'UNSAFE_URL'],
    ['#absent', 'INVALID_ANCHOR'],
    ['#%zz', 'INVALID_ANCHOR'],
  ]) {
    const nested = nestedList(listLimits.depth);
    let group = nested;
    for (let depth = 1; depth < listLimits.depth; depth++)
      group = group.items[0].children;
    group.items[0].content[0].href = href;
    diagnostic(
      nested,
      '/items/0/children'.repeat(listLimits.depth - 1) +
        '/items/0/content/0/href',
      code,
    );
  }
});

test('Code preserves literal whitespace, CRLF and script-like data and never generates executable content', () => {
  const text =
    '\n\tconst tag = `<>&`;\r\n\r  </code></pre><script>alert(1)</script>\n\n';
  const input = document({
    kind: 'code',
    text,
    language: '"><img src=x onerror=alert(1)>',
  });
  const output = compile(input);
  assert.equal(output.document.data.sections[0].blocks[0].text, text);
  assert.ok(
    output.html.includes(
      '&#13;\n&#13;  &lt;/code&gt;&lt;/pre&gt;&lt;script&gt;',
    ),
  );
  assert.match(output.html, /<pre\b[^>]*\btabindex="0"/u);
  assert.ok(!output.html.includes('<img'));
  assert.ok(!output.html.includes('<script>alert(1)</script>'));
  assert.equal(output.plan.blocks[0].selected, 'code.block');
  assert.doesNotThrow(() =>
    compile(document({ kind: 'code', text: '😀'.repeat(codeLimits.text) })),
  );
  for (const [block, path, code] of [
    [{ kind: 'code', text: '' }, '/text', 'SCHEMA_MINLENGTH'],
    [{ kind: 'code', text: 42 }, '/text', 'SCHEMA_TYPE'],
    [
      { kind: 'code', text: 'x'.repeat(codeLimits.text + 1) },
      '/text',
      'SCHEMA_MAXLENGTH',
    ],
    [
      { kind: 'code', text: 'x', language: '' },
      '/language',
      'SCHEMA_MINLENGTH',
    ],
    [
      {
        kind: 'code',
        text: 'x',
        language: 'x'.repeat(codeLimits.language + 1),
      },
      '/language',
      'SCHEMA_MAXLENGTH',
    ],
    [
      { kind: 'code', text: 'x', execute: true },
      '/execute',
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
    ...['\u0000', '\ud800', '\udfff'].map((text) => [
      { kind: 'code', text },
      '/text',
      'SCHEMA_PATTERN',
    ]),
  ])
    diagnostic(block, path, code);
});

test('technical-guide edit changes only one command and one nested item, retaining sources and selections', () => {
  const initial = technicalGuide();
  const edited = technicalGuide(true);
  assert.ok(
    edited.sections[1].blocks[0].text.endsWith('--explain --theme midnight\n'),
  );
  assert.equal(
    edited.sections[0].blocks[1].items[0].children.items[1].content[0].text,
    '保留輸入 JSON 與 presentation config，方便後續重建。',
  );
  const reverted = structuredClone(edited);
  reverted.sections[1].blocks[0].text = initial.sections[1].blocks[0].text;
  reverted.sections[0].blocks[1].items[0].children.items[1].content[0].text =
    initial.sections[0].blocks[1].items[0].children.items[1].content[0].text;
  assert.deepEqual(reverted, initial);
  const first = compile(initial);
  const after = compile(edited);
  assert.deepEqual(after.plan, first.plan);
  assert.deepEqual(after.document.data.sources, first.document.data.sources);
  assert.notEqual(after.html, first.html);
});
