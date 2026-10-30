import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import {
  compile,
  createRegistry,
  documentSchema,
  inlineLimits,
  loadRegistry,
  SemloomError,
} from '../dist/index.js';
import { inlineContentSchema } from '../dist/core/inline.js';

const example = JSON.parse(readFileSync('examples/richtext.json', 'utf8'));
const document = (content) => ({
  schemaVersion: '1.0',
  title: 'Inline contract',
  sections: [{ title: 'Content', blocks: [{ kind: 'richtext', content }] }],
});
const diagnostic = (input, path, code) => {
  assert.throws(
    () => compile(input),
    (error) => {
      assert.ok(error instanceof SemloomError);
      assert.ok(error.diagnostics.length > 0);
      assert.ok(
        error.diagnostics.some((d) => d.path === path && d.code === code),
        error.message,
      );
      return true;
    },
  );
};

test('inline schemas are self-contained alone, in a kind and in the exported document contract', () => {
  const ajv = new Ajv({ strict: true });
  const registry = createRegistry();
  const content = example.sections[0].blocks[0].content;
  const validateInline = ajv.compile(inlineContentSchema());
  assert.equal(validateInline(content), true);
  assert.equal(validateInline([{ text: 'x', children: [] }]), false);
  const kind = registry.definitions().find((kind) => kind.kind === 'richtext');
  assert.equal(ajv.compile(kind.schema)({ content }), true);
  const validateDocument = ajv.compile(documentSchema(registry));
  assert.equal(validateDocument(example), true);
  assert.equal(
    validateDocument(document([{ text: 'x', marks: ['unknown'] }])),
    false,
  );
});

test('richtext preserves run boundaries, combinations, data, citations and deterministic selections', () => {
  const original = structuredClone(example);
  const result = compile(example);
  assert.deepEqual(example, original);
  assert.deepEqual(result.document.data, original);
  assert.equal(result.plan.blocks[0].selected, 'richtext.paragraph');
  assert.ok(result.html.includes('data-variant="richtext.paragraph"'));
  assert.ok(result.html.includes('用 <strong>結構化片段</strong> 表達內容'));
  assert.ok(result.html.includes('<em><code>compile()</code></em>'));
  assert.ok(
    result.html.includes('<a href="#details"><strong>實作細節</strong></a>'),
  );
  assert.equal((result.html.match(/class="citations"/g) ?? []).length, 1);
  assert.equal(result.html, compile(example).html);
  const overridden = compile(example, {
    overrides: { 'rich-content': 'richtext.paragraph' },
  });
  assert.equal(overridden.plan.blocks[0].origin, 'override');
  assert.equal(overridden.html, result.html);

  for (const [marks, expected] of [
    [[], 'value'],
    [['strong'], '<strong>value</strong>'],
    [['emphasis'], '<em>value</em>'],
    [['code'], '<code>value</code>'],
    [['strong', 'emphasis'], '<strong><em>value</em></strong>'],
    [['strong', 'code'], '<strong><code>value</code></strong>'],
    [['emphasis', 'code'], '<em><code>value</code></em>'],
    [
      ['strong', 'emphasis', 'code'],
      '<strong><em><code>value</code></em></strong>',
    ],
  ]) {
    for (const href of [undefined, 'https://example.com/?a=1&b=2']) {
      const run = {
        text: 'value',
        ...(marks.length ? { marks: [...marks].reverse() } : {}),
        ...(href ? { href } : {}),
      };
      const output = compile(document([run])).html;
      assert.ok(
        output.includes(
          href
            ? `<a href="https://example.com/?a=1&amp;b=2">${expected}</a>`
            : expected,
        ),
      );
    }
  }
});

test('inline structure rejects unsupported formats, recursion and unknown fields with precise paths', () => {
  const base = '/sections/0/blocks/0/content';
  for (const [content, path, code] of [
    [[], base, 'SCHEMA_MINITEMS'],
    ['text', base, 'SCHEMA_TYPE'],
    [[{}], `${base}/0/text`, 'SCHEMA_REQUIRED'],
    [[{ text: '' }], `${base}/0/text`, 'SCHEMA_MINLENGTH'],
    [[{ text: 1 }], `${base}/0/text`, 'SCHEMA_TYPE'],
    [
      [{ text: 'x', html: '<b>x</b>' }],
      `${base}/0/html`,
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
    [
      [{ text: 'x', children: [{ text: 'nested' }] }],
      `${base}/0/children`,
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
    [[{ text: 'x', marks: ['bold'] }], `${base}/0/marks/0`, 'SCHEMA_ENUM'],
    [
      [{ text: 'x', marks: ['strong', 'strong'] }],
      `${base}/0/marks`,
      'SCHEMA_UNIQUEITEMS',
    ],
    [[{ text: 'x', marks: [] }], `${base}/0/marks`, 'SCHEMA_MINITEMS'],
    [[{ text: 'x', marks: 'strong' }], `${base}/0/marks`, 'SCHEMA_TYPE'],
    [[{ text: 'x', href: 1 }], `${base}/0/href`, 'SCHEMA_TYPE'],
    [[{ text: 'x', href: '' }], `${base}/0/href`, 'SCHEMA_MINLENGTH'],
  ])
    diagnostic(document(content), path, code);
  const input = document([{ text: 'x' }]);
  input.sections[0].blocks[0].text = 'ignored?';
  diagnostic(input, '/sections/0/blocks/0/text', 'SCHEMA_ADDITIONALPROPERTIES');
});

test('inline limits cover run count, per-run and total Unicode text, and URL length', () => {
  assert.doesNotThrow(() =>
    compile(
      document(
        Array.from({ length: inlineLimits.runs }, () => ({ text: 'x' })),
      ),
    ),
  );
  diagnostic(
    document(
      Array.from({ length: inlineLimits.runs + 1 }, () => ({ text: 'x' })),
    ),
    '/sections/0/blocks/0/content',
    'SCHEMA_MAXITEMS',
  );
  assert.doesNotThrow(() =>
    compile(document([{ text: 'x'.repeat(inlineLimits.text) }])),
  );
  diagnostic(
    document([{ text: 'x'.repeat(inlineLimits.text + 1) }]),
    '/sections/0/blocks/0/content/0/text',
    'SCHEMA_MAXLENGTH',
  );
  const unicode = [{ text: '😀'.repeat(50000) }, { text: '文'.repeat(50000) }];
  assert.doesNotThrow(() => compile(document(unicode)));
  diagnostic(
    document([...unicode, { text: 'x' }]),
    '/sections/0/blocks/0/content/2/text',
    'INLINE_LIMIT',
  );
  const url = 'https://example.com/';
  assert.doesNotThrow(() =>
    compile(
      document([
        { text: 'link', href: url + 'x'.repeat(inlineLimits.url - url.length) },
      ]),
    ),
  );
  diagnostic(
    document([
      {
        text: 'link',
        href: url + 'x'.repeat(inlineLimits.url - url.length + 1),
      },
    ]),
    '/sections/0/blocks/0/content/0/href',
    'SCHEMA_MAXLENGTH',
  );
});

test('inline links share source URL policy and reject malformed or missing document targets', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///tmp/x',
    'mailto:a@example.com',
    '//example.com',
    ' https://example.com',
    'https://example.com/a b',
    'https://example.com/\nx',
    'https://user:password@example.com',
    '#',
  ])
    diagnostic(
      document([{ text: 'link', href }]),
      '/sections/0/blocks/0/content/0/href',
      'UNSAFE_URL',
    );
  for (const href of ['#missing', '#%zz', '#__proto__'])
    diagnostic(
      document([{ text: 'link', href }]),
      '/sections/0/blocks/0/content/0/href',
      'INVALID_ANCHOR',
    );
  for (const href of [
    'https://example.com/path?q=1#external',
    'http://example.com',
  ])
    assert.doesNotThrow(() => compile(document([{ text: 'link', href }])));
});

test('references resolve after all explicit and generated IDs, including sources and Chinese targets', () => {
  const input = document([
    { text: 'section', href: '#%E4%B8%AD%E6%96%87' },
    { text: 'block', href: '#later' },
    { text: 'generated block', href: '#prose' },
    { text: 'source', href: '#semloom-source-reference' },
  ]);
  input.sections.push({
    title: '中文',
    blocks: [
      { kind: 'prose', text: 'generated' },
      { id: 'later', kind: 'prose', text: 'explicit' },
    ],
  });
  input.sources = [{ id: 'reference', title: 'Local', url: '#later' }];
  assert.doesNotThrow(() => compile(input));
  input.sections[1].blocks.splice(1);
  diagnostic(input, '/sources/0/url', 'INVALID_ANCHOR');
  delete input.sources[0].url;
  diagnostic(input, '/sections/0/blocks/0/content/1/href', 'INVALID_ANCHOR');
});

test('richtext escapes text and attributes while existing prose and Plugin strings remain literal', async () => {
  const payload =
    '</p></script><img src=x onerror="alert(1)"> **text** `code` &';
  const input = document([
    {
      text: payload,
      marks: ['strong', 'emphasis', 'code'],
      href: 'https://example.com/?q="<>&',
    },
  ]);
  const output = compile(input).html;
  assert.ok(output.includes('<strong><em><code>&lt;/p&gt;&lt;/script&gt;'));
  assert.ok(
    output.includes('href="https://example.com/?q=&quot;&lt;&gt;&amp;"'),
  );
  assert.ok(!output.includes('<img'));
  const plain = {
    ...input,
    sections: [{ title: 'Plain', blocks: [{ kind: 'prose', text: payload }] }],
  };
  const plainOutput = compile(plain).html;
  assert.ok(!plainOutput.includes('<strong>'));
  assert.ok(!plainOutput.includes('<code>'));
  assert.ok(plainOutput.includes('**text** `code`'));
  const registry = await loadRegistry([
    './examples/comparison-plugin/index.mjs',
  ]);
  plain.sections[0].blocks.push({ kind: 'example.note', text: payload });
  const pluginOutput = compile(plain, {}, registry).html;
  assert.ok(!pluginOutput.includes('<strong>'));
  assert.ok(!pluginOutput.includes('<img'));
  assert.equal((pluginOutput.match(/\*\*text\*\* `code`/g) ?? []).length, 2);
});
