import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv } from 'ajv';
import { spawnSync } from 'node:child_process';
import {
  compile,
  createRegistry,
  documentSchema,
  html,
  parseConfig,
} from '../dist/index.js';

const document = (block) => ({
  schemaVersion: '1.0',
  title: 'Validation reuse',
  sections: [{ title: 'Content', blocks: [block] }],
});
const plugin = (type) => ({
  id: 'fixture.validation',
  version: '1.0',
  pluginApiVersion: '1.0',
  kinds: [
    {
      kind: 'fixture.value',
      dataVersion: '1.0',
      schema: {
        type: 'object',
        properties: { value: { type } },
        required: ['value'],
      },
      variants: [
        {
          id: 'fixture.value.text',
          supports: () => ({ supported: true, reason: 'Complete value.' }),
          score: () => 1,
          render: (block) => html`<p>${block.value}</p>`,
        },
      ],
    },
  ],
});

test('default compilation reuses validators while checking each new document and config', (t) => {
  const spy = t.mock.method(Ajv.prototype, 'compile');
  const first = compile(document({ kind: 'prose', text: 'First' }));
  const compiled = spy.mock.callCount();
  assert.ok(compiled > 0);
  const second = compile(document({ kind: 'prose', text: 'Second' }), {
    theme: 'midnight',
  });
  assert.match(second.html, /Second/);
  assert.notEqual(second.html, first.html);
  const duplicate = document({ id: 'same', kind: 'prose', text: 'Semantic' });
  duplicate.sections[0].id = 'same';
  assert.throws(() => compile(duplicate), /DUPLICATE_ID/);
  assert.equal(spy.mock.callCount(), compiled);
  assert.throws(
    () => compile(document({ kind: 'prose', text: 42 })),
    /SCHEMA_TYPE/,
  );
  assert.throws(() => parseConfig({ interactive: 'true' }), /SCHEMA_TYPE/);
  assert.throws(() => parseConfig({ theme: 'unknown' }), /UNKNOWN_THEME/);
  assert.match(
    compile(document({ kind: 'prose', text: 'Third' })).html,
    /Third/,
  );
  // Failed document/config validators are rebuilt, then reused after success.
  const restored = spy.mock.callCount();
  assert.equal(restored, compiled + 2);
  compile(document({ kind: 'prose', text: 'Fourth' }));
  parseConfig({ interactive: true });
  assert.equal(spy.mock.callCount(), restored);
});

test('reused Registry validators isolate identical Plugin IDs with different Schemas and preserve diagnostics', (t) => {
  const strings = createRegistry([plugin('string')]);
  const numbers = createRegistry([plugin('number')]);
  const spy = t.mock.method(Ajv.prototype, 'compile');
  const text = document({ kind: 'fixture.value', value: 'text' });
  const number = document({ kind: 'fixture.value', value: 42 });
  compile(text, {}, strings);
  compile(number, {}, numbers);
  const compiled = spy.mock.callCount();
  let firstError;
  assert.throws(
    () => compile(number, {}, strings),
    (error) => {
      firstError = error;
      assert.ok(
        error.diagnostics.some(
          (d) =>
            d.path === '/sections/0/blocks/0/value' && d.code === 'SCHEMA_TYPE',
        ),
      );
      return true;
    },
  );
  const diagnostics = structuredClone(firstError.diagnostics);
  assert.throws(() => compile(text, {}, numbers), /SCHEMA_TYPE/);
  assert.throws(
    () => compile(document({ kind: 'fixture.value' }), {}, strings),
    /SCHEMA_REQUIRED/,
  );
  assert.throws(
    () => compile(document({ kind: 'fixture.unknown' }), {}, strings),
    /UNKNOWN_KIND/,
  );
  assert.deepEqual(firstError.diagnostics, diagnostics);
  compile(text, {}, strings);
  compile(number, {}, numbers);
  const restored = spy.mock.callCount();
  assert.ok(restored > compiled);
  compile(text, {}, strings);
  compile(number, {}, numbers);
  assert.equal(spy.mock.callCount(), restored);
});

test('exported Schemas and Registry copies cannot alter cached validation or default built-ins', () => {
  const manifest = plugin('string');
  const registry = createRegistry([manifest]);
  const input = document({ kind: 'fixture.value', value: 'text' });
  const baseline = compile(input, {}, registry).html;
  const exported = documentSchema(registry);
  const original = structuredClone(exported);
  exported.properties.title.minLength = 1000;
  exported.definitions.block.oneOf.find(
    (branch) => branch.properties.kind.const === 'fixture.value',
  ).properties.value.type = 'number';
  exported.definitions.block.oneOf[0].properties.id.minLength = 1000;
  manifest.kinds[0].schema.properties.value.type = 'number';
  registry.definitions()[0].schema.properties.text.type = 'number';
  assert.deepEqual(documentSchema(registry), original);
  assert.equal(compile(input, {}, registry).html, baseline);
  assert.throws(
    () => compile(document({ kind: 'fixture.value', value: 42 }), {}, registry),
    /SCHEMA_TYPE/,
  );
  assert.throws(() => registry.register(plugin('number')), /REGISTRY_FROZEN/);
  const fresh = createRegistry();
  assert.notEqual(fresh, createRegistry());
  assert.throws(() => compile(input, {}, fresh), /UNKNOWN_KIND/);
  assert.throws(() => compile(input), /UNKNOWN_KIND/);
  compile(document({ id: 'p', kind: 'prose', text: 'Default remains valid' }));
});

test('failed validators can be collected before another validation, including referenced validators', () => {
  // Keep the GC check in a separate process; assert reachability, not heap sizes.
  const result = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      '--input-type=module',
      '-e',
      `
import assert from 'node:assert/strict';
import { Ajv } from 'ajv';
import { setImmediate as tick } from 'node:timers/promises';
import { compile, parseConfig, createPresentation } from ${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)};
const original = Ajv.prototype.compile;
const validators = new Map();
Ajv.prototype.compile = function(schema, ...args) {
  const validate = original.call(this, schema, ...args);
  const key = schema.$id?.includes('document-1.0') ? 'document'
    : schema.properties?.interactive ? 'config'
    : schema.properties?.themes?.items ? 'presentation' : undefined;
  if (key) validators.set(key, new WeakRef(validate));
  return validate;
};
const valid = { schemaVersion: '1.0', title: 'Memory', sections: [
  { title: 'Content', blocks: [{ kind: 'prose', text: 'Valid' }] }
] };
compile(valid);
const invalid = structuredClone(valid);
invalid.sections[0].blocks = Array.from({ length: 1000 }, () => ({ kind: 'prose', text: 42 }));
let diagnostics;
assert.throws(() => compile(invalid), error => {
  diagnostics = error.diagnostics;
  assert.equal(diagnostics.length, 12);
  assert.ok(diagnostics.every(d => d.code === 'SCHEMA_TYPE'));
  return true;
});
async function collected(key) {
  const weak = validators.get(key);
  assert.ok(weak, key + ' validator was compiled');
  for (let i = 0; i < 3; i++) { await tick(); global.gc(); }
  await tick();
  assert.equal(weak.deref() === undefined, true, key + ' failed validator must be collectible');
}
await collected('document');
assert.throws(() => parseConfig({ overrides: Object.fromEntries(
  Array.from({ length: 1000 }, (_, i) => ['block-' + i, 42])
) }), /SCHEMA_TYPE/);
await collected('config');
assert.throws(() => createPresentation({ themes: Array.from({ length: 50 }, (_, i) => ({
  id: 'invalid.' + i, themeApiVersion: 'wrong'
})) }), /SCHEMA_CONST/);
await collected('presentation');
const throwing = { ...valid, get title() { throw new Error('getter failed'); } };
assert.throws(() => compile(throwing), /getter failed/);
await collected('document');
const before = JSON.stringify(diagnostics);
compile(valid);
assert.equal(JSON.stringify(diagnostics), before);
console.log(JSON.stringify({ collected: ['document', 'config', 'presentation', 'exception'], diagnostics: diagnostics.length }));
`,
    ],
    { encoding: 'utf8', timeout: 30000 },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.deepEqual(JSON.parse(result.stdout), {
    collected: ['document', 'config', 'presentation', 'exception'],
    diagnostics: 12,
  });
});
