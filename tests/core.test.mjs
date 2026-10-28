import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv } from 'ajv';
import {
  compile,
  createRegistry,
  documentSchema,
  resolveDocument,
  Registry,
  html,
  parseConfig,
} from '../dist/index.js';
import { comparisonDocument, research } from './helpers.mjs';

function rejects(input, pattern, options) {
  assert.throws(() => compile(input, options), pattern);
}
test('cards/table share validated data, preserve field order, references, false/zero/empty/missing/null', () => {
  const input = comparisonDocument({
    zero: 0,
    false: false,
    empty: '',
    nil: null,
    absent: null,
  });
  delete input.sections[0].blocks[0].items[0].attributes.absent;
  input.sources = [
    { id: 'source', title: '來源 <unsafe>' },
    { id: 'unused', title: '未引用' },
  ];
  input.sections[0].blocks[0].sourceIds = ['source'];
  const copy = structuredClone(input);
  for (const variant of ['comparison.cards', 'comparison.table']) {
    const result = compile(input, { overrides: { compare: variant } });
    assert.match(result.html, />0</);
    assert.match(result.html, />false</);
    assert.equal((result.html.match(/未提供/g) ?? []).length, 2);
    assert.match(result.html, /來源 &lt;unsafe&gt;/);
    assert.match(result.html, /未引用/);
    assert.equal(result.plan.blocks[0].selected, variant);
    assert.equal(result.plan.blocks[0].origin, 'override');
    assert.deepEqual(result.document.data, input);
  }
  assert.deepEqual(input, copy);
});
test('exported Schema validates comparison data and rejects coercion, unknown fields, missing fields and new kinds', () => {
  const validate = new Ajv({ strict: true }).compile(
    documentSchema(createRegistry()),
  );
  assert.equal(validate(research), true);
  for (const edit of [
    (d) => {
      d.sections[0].blocks[0].text = 42;
    },
    (d) => {
      d.sections[0].blocks[0].text = { bold: 'test' };
    },
    (d) => {
      d.sections[0].blocks[0].css = 'color:red';
    },
    (d) => {
      delete d.sections[0].blocks[0].text;
    },
    (d) => {
      d.sections[0].blocks[0].kind = 'unknown.kind';
    },
    (d) => {
      d.schemaVersion = '2.0';
    },
  ]) {
    const input = structuredClone(research);
    edit(input);
    assert.equal(validate(input), false);
    rejects(input, /SCHEMA|UNKNOWN_KIND/);
  }
});
test('semantic validation rejects field loss, duplicate IDs/fields, dangling/duplicate sources and deep trees', () => {
  const mutations = [
    (d) => {
      d.sections[0].blocks[0].items[0].attributes.hidden = 'cannot disappear';
    },
    (d) => {
      d.sections[0].blocks[0].fields.push({ key: 'value', label: 'duplicate' });
    },
    (d) => {
      d.sections[0].id = 'compare';
    },
    (d) => {
      d.sections[0].id = 'semloom-reserved';
    },
    (d) => {
      d.sections[0].blocks[0].sourceIds = ['missing'];
    },
    (d) => {
      d.sources = [
        { id: 's', title: 'A' },
        { id: 's', title: 'B' },
      ];
    },
    (d) => {
      d.sources = [{ id: 's', title: 'A' }];
      d.sections[0].blocks[0].sourceIds = ['s', 's'];
    },
    (d) => {
      let section = d.sections[0];
      for (let i = 0; i < 8; i++) {
        section.sections = [{ title: 'nested' }];
        section = section.sections[0];
      }
    },
  ];
  for (const mutate of mutations) {
    const input = comparisonDocument();
    mutate(input);
    assert.throws(() => compile(input));
  }
  const infinite = comparisonDocument({ value: Infinity });
  assert.throws(() => compile(infinite));
});
test('URLs reject unsafe schemes, whitespace and broken anchors while accepting encoded Chinese anchors', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    ' https://example.com',
    'https://x.test/\na',
    '#missing',
    '#%ZZ',
    'https://user:pass@example.com',
  ]) {
    const input = comparisonDocument();
    input.sources = [{ id: 's', title: 'source', url }];
    rejects(input, /UNSAFE_URL|INVALID_ANCHOR/);
  }
  const input = comparisonDocument();
  input.sources = [
    { id: 's', title: 'source', url: '#%E4%B8%AD%E6%96%87%E7%AB%A0%E7%AF%80' },
  ];
  assert.match(compile(input).html, /id="中文章節"/);
});
test('auto IDs reserve explicit IDs first; allocation is deterministic and does not alter the input', () => {
  const input = comparisonDocument();
  input.sections = [
    { title: '同名' },
    { id: '同名', title: 'Explicit' },
    { title: '同名' },
  ];
  const first = resolveDocument(input, createRegistry());
  assert.deepEqual(
    first.sections.map((s) => s.id),
    ['同名-2', '同名', '同名-3'],
  );
  assert.equal(compile(input).html, compile(input).html);
  rejects(input, /OVERRIDE_TARGET/, {
    overrides: { '同名-2': 'comparison.table' },
  });
});
test('Planner weighs item/field/text size, permits lower-score overrides and rejects unknown targets', () => {
  const small = comparisonDocument();
  assert.equal(compile(small).plan.blocks[0].selected, 'comparison.cards');
  const many = comparisonDocument();
  many.sections[0].blocks[0].items = Array.from({ length: 4 }, (_, i) => ({
    name: String(i),
    attributes: { value: i },
  }));
  assert.equal(compile(many).plan.blocks[0].selected, 'comparison.table');
  assert.equal(
    compile(comparisonDocument({ value: '長'.repeat(91) })).plan.blocks[0]
      .selected,
    'comparison.table',
  );
  assert.equal(
    compile(comparisonDocument({ a: 1, b: 2, c: 3, d: 4 })).plan.blocks[0]
      .selected,
    'comparison.table',
  );
  assert.equal(
    compile(small, { overrides: { compare: 'comparison.table' } }).plan
      .blocks[0].selected,
    'comparison.table',
  );
  rejects(small, /INVALID_OVERRIDE/, { overrides: { compare: 'missing' } });
  rejects(small, /OVERRIDE_TARGET/, {
    overrides: { missing: 'comparison.table' },
  });
});
test('plain text is escaped in all contexts, including embedded script terminators and source titles', () => {
  const payload =
    '</script><img src=x onerror="alert(1)"> **bold** `code` https://example.com';
  const input = comparisonDocument({ value: payload });
  input.title = payload;
  input.sections[0].title = payload;
  input.sources = [{ id: '"<>', title: payload }];
  input.sections[0].blocks[0].sourceIds = ['"<>'];
  const output = compile(input).html;
  assert.ok(!output.includes('<img'));
  assert.equal((output.match(/<script /g) ?? []).length, 1);
  assert.ok(output.includes('<script data-semloom-navigation>'));
  assert.match(output, /&lt;\/script&gt;/);
  assert.match(output, /\*\*bold\*\*/);
  assert.match(output, /id="semloom-source-&quot;&lt;&gt;"/);
});
test('strict configuration rejects unsupported themes, layouts, invalid plugin paths and nonboolean interactive', () => {
  for (const config of [
    { interactive: 'true' },
    { plugins: 'not-an-array' },
    { theme: 'unknown' },
    { layout: 'unknown' },
    { unknown: true },
  ])
    assert.throws(() => parseConfig(config));
});

test('prototype-named missing attributes and IDs do not read inherited object properties', () => {
  const input = comparisonDocument();
  input.sections[0].blocks[0].id = 'toString';
  input.sections[0].blocks[0].fields = [
    { key: 'constructor', label: 'missing' },
  ];
  input.sections[0].blocks[0].items[0].attributes = {};
  assert.match(compile(input).html, /未提供/);
  assert.ok(!compile(input).html.includes('[native code]'));
});

test('HTML templates preserve interpolated whitespace and explicit inline separation; nested cards follow heading depth', () => {
  assert.equal(
    html`<p>${'  first\nsecond  '}</p>`.value,
    '<p>  first\nsecond  </p>',
  );
  assert.equal(
    html`<span>A</span> <span>${'B'}</span>`.value,
    '<span>A</span> <span>B</span>',
  );
  const input = comparisonDocument();
  const block = input.sections[0].blocks[0];
  input.sections[0].blocks = [];
  input.sections[0].sections = [{ title: 'Child', blocks: [block] }];
  const result = compile(input);
  assert.match(result.html, /<h4>比較<\/h4>/);
  assert.match(result.html, /<h5>A<\/h5>/);
});

test('user-shaped objects cannot forge a trusted HTML fragment', () => {
  const forged = { value: '<img src=x onerror=alert(1)>', __safeHtml: true };
  assert.equal(html`<p>${forged}</p>`.value, '<p>[object Object]</p>');
});
test('custom kinds use the same Registry, Schema, Planner and renderer; tie-break ignores registration order', () => {
  const variant = (id, supported = true) => ({
    id,
    supports: () => ({ supported, reason: 'test support' }),
    score: () => 5,
    render: (b) => html`<p>${b.text}</p>`,
  });
  for (const variants of [
    [variant('custom.z'), variant('custom.a')],
    [variant('custom.a'), variant('custom.z')],
  ]) {
    const registry = new Registry();
    registry.register({
      id: 'test',
      version: '1',
      pluginApiVersion: '1.0',
      kinds: [
        {
          kind: 'test.note',
          dataVersion: '1.0',
          schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
          variants,
        },
      ],
    });
    const document = {
      schemaVersion: '1.0',
      title: 'Custom',
      sources: [{ id: 's', title: 'Source' }],
      sections: [
        {
          title: 'Section',
          blocks: [{ kind: 'test.note', text: 'value', sourceIds: ['s'] }],
        },
      ],
    };
    const result = compile(document, {}, registry);
    assert.equal(result.plan.blocks[0].selected, 'custom.a');
    assert.match(result.html, /本區塊來源/);
    assert.throws(
      () => registry.register({ id: 'other', kinds: [] }),
      /REGISTRY_FROZEN/,
    );
  }
});
test('no compatible candidates and rendering failures fail instead of silently dropping content', () => {
  for (const renderError of [false, true]) {
    const registry = new Registry();
    registry.register({
      id: 'test',
      version: '1',
      pluginApiVersion: '1.0',
      kinds: [
        {
          kind: 'test.note',
          dataVersion: '1.0',
          schema: { type: 'object', properties: {} },
          variants: [
            {
              id: 'test.view',
              supports: () => ({ supported: renderError, reason: 'test' }),
              score: () => 0,
              render: () => {
                throw new Error('failure');
              },
            },
          ],
        },
      ],
    });
    assert.throws(
      () =>
        compile(
          {
            schemaVersion: '1.0',
            title: 'T',
            sections: [{ title: 'S', blocks: [{ kind: 'test.note' }] }],
          },
          {},
          registry,
        ),
      renderError ? /RENDER_FAILED/ : /NO_VARIANT/,
    );
  }
});
