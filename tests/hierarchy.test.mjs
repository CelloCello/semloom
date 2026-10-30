import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv } from 'ajv';
import {
  compile,
  createRegistry,
  documentSchema,
  hierarchyLimits,
  SemloomError,
} from '../dist/index.js';
import {
  hierarchyDocument,
  hierarchyChain,
  hierarchyWide,
} from './fixtures/hierarchy.mjs';
import { toMindmapNode } from '../dist/browser/hierarchy.js';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const document = (root) => ({
  schemaVersion: '1.0',
  title: 'Hierarchy',
  sections: [
    { title: 'Content', blocks: [{ kind: 'hierarchy', id: 'map', root }] },
  ],
});
function facts(root) {
  return [root.label, ...(root.children ?? []).flatMap(facts)];
}
function diagnostic(input, path, code) {
  assert.throws(
    () => compile(input),
    (error) => {
      assert.ok(error instanceof SemloomError);
      assert.ok(
        error.diagnostics.some((d) => d.path === path && d.code === code),
        error.message,
      );
      return true;
    },
  );
}

test('Hierarchy schema is self-contained, finite and strict in Registry and full documents', () => {
  const registry = createRegistry();
  const ajv = new Ajv({ strict: true });
  const kind = registry.definitions().find((k) => k.kind === 'hierarchy');
  const validateKind = ajv.compile(kind.schema);
  assert.equal(
    validateKind({ root: hierarchyChain(hierarchyLimits.depth) }),
    true,
  );
  const validate = ajv.compile(documentSchema(registry));
  assert.equal(
    validate(hierarchyDocument()),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(
    validate(document(hierarchyChain(hierarchyLimits.depth + 1))),
    false,
  );
  const blockPath = '/sections/0/blocks/0';
  for (const [root, path, code] of [
    [{}, '/root/label', 'SCHEMA_REQUIRED'],
    [{ label: '' }, '/root/label', 'SCHEMA_MINLENGTH'],
    [{ label: 1 }, '/root/label', 'SCHEMA_TYPE'],
    [{ label: 'x', children: 'child' }, '/root/children', 'SCHEMA_TYPE'],
    [
      { label: 'x', children: [{ label: 'y', id: 'node-anchor' }] },
      '/root/children/0/id',
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
    [
      { label: 'x', href: '#target' },
      '/root/href',
      'SCHEMA_ADDITIONALPROPERTIES',
    ],
  ])
    diagnostic(document(root), blockPath + path, code);
  const noRoot = document({ label: 'x' });
  delete noRoot.sections[0].blocks[0].root;
  diagnostic(noRoot, blockPath + '/root', 'SCHEMA_REQUIRED');
});

test('Hierarchy boundaries include root, all descendants and Unicode labels, without truncation', () => {
  assert.doesNotThrow(() =>
    compile(document(hierarchyWide(hierarchyLimits.nodes))),
  );
  diagnostic(
    document(hierarchyWide(hierarchyLimits.nodes + 1)),
    `/sections/0/blocks/0/root/children/${hierarchyLimits.nodes - 1}`,
    'HIERARCHY_LIMIT',
  );
  assert.doesNotThrow(() =>
    compile(document(hierarchyChain(hierarchyLimits.depth))),
  );
  diagnostic(
    document(hierarchyChain(hierarchyLimits.depth + 1)),
    '/sections/0/blocks/0/root' +
      '/children/0'.repeat(hierarchyLimits.depth - 1) +
      '/children',
    'SCHEMA_MAXITEMS',
  );
  assert.doesNotThrow(() =>
    compile(
      document({ label: '😀'.repeat(hierarchyLimits.label), children: [] }),
    ),
  );
  diagnostic(
    document({ label: '文'.repeat(hierarchyLimits.label + 1) }),
    '/sections/0/blocks/0/root/label',
    'SCHEMA_MAXLENGTH',
  );
  const cycle = { label: 'Cycle' };
  cycle.children = [cycle];
  assert.throws(() => compile(document(cycle)), SemloomError);
});

test('tree is the stable default, mindmap requires override, and both preserve input order and Core citations', () => {
  const input = hierarchyDocument();
  const original = structuredClone(input);
  const tree = compile(input);
  const mindmap = compile(input, {
    overrides: { 'architecture-map': 'hierarchy.mindmap' },
    interactive: true,
  });
  assert.equal(tree.plan.blocks[1].selected, 'hierarchy.tree');
  assert.equal(mindmap.plan.blocks[1].selected, 'hierarchy.mindmap');
  assert.equal(mindmap.plan.blocks[1].origin, 'override');
  for (const output of [tree, mindmap]) {
    assert.deepEqual(output.document.data, original);
    assert.deepEqual(input, original);
    const labels = facts(input.sections[0].blocks[1].root);
    let position = -1;
    for (const label of labels) {
      position = output.html.indexOf(`>${label}</div>`, position + 1);
      assert.ok(position >= 0, label);
    }
    assert.equal(
      (output.html.match(/class="semloom-hierarchy-label"/g) ?? []).length,
      labels.length,
    );
    assert.equal(
      (output.html.match(/data-asset="semloom.hierarchy"/g) ?? []).length,
      1,
    );
    assert.equal((output.html.match(/class="citations"/g) ?? []).length, 2);
    assert.ok(!output.html.includes('data-semloom-interactive'));
    assert.ok(!output.html.includes('data-switcher'));
  }
  assert.equal(tree.html, compile(input).html);
  assert.equal(
    mindmap.html,
    compile(input, { overrides: { 'architecture-map': 'hierarchy.mindmap' } })
      .html,
  );
  assert.ok(
    !compile({
      schemaVersion: '1.0',
      title: 'No hierarchy',
      sections: [{ title: 'S' }],
    }).html.includes('data-asset="semloom.hierarchy"'),
  );
});

test('node labels stay literal, cannot forge markup, and do not become document anchors or Override targets', () => {
  const payload = '</div></script><img src=x onerror="alert(1)"> **label** &';
  const input = document({ label: payload, children: [{ label: 'child' }] });
  for (const variant of ['hierarchy.tree', 'hierarchy.mindmap']) {
    const output = compile(input, { overrides: { map: variant } }).html;
    assert.ok(output.includes('&lt;/div&gt;&lt;/script&gt;&lt;img'));
    assert.ok(!output.includes('<img'));
    assert.ok(output.includes('**label** &amp;'));
    assert.ok(!output.includes('id="child"'));
  }
  assert.throws(
    () => compile(input, { overrides: { child: 'hierarchy.tree' } }),
    /OVERRIDE_TARGET/,
  );
  input.sources = [{ id: 's', title: 'node target', url: '#child' }];
  diagnostic(input, '/sources/0/url', 'INVALID_ANCHOR');
});

test('branch relocation and a label edit update both views without changing other content, sources or IDs', () => {
  const initial = hierarchyDocument();
  const edited = hierarchyDocument(true);
  const firstRoot = initial.sections[0].blocks[1].root;
  const afterRoot = edited.sections[0].blocks[1].root;
  assert.equal(afterRoot.children[1].children.length, 1);
  assert.deepEqual(
    afterRoot.children[2].children.at(-1).children,
    firstRoot.children[1].children[0].children,
  );
  const reverted = structuredClone(edited);
  const moved = reverted.sections[0].blocks[1].root.children[2].children.pop();
  moved.label = 'Theme';
  reverted.sections[0].blocks[1].root.children[1].children.unshift(moved);
  assert.deepEqual(reverted, initial);
  for (const variant of ['hierarchy.tree', 'hierarchy.mindmap']) {
    const options = { overrides: { 'architecture-map': variant } };
    const before = compile(initial, options),
      after = compile(edited, options);
    assert.deepEqual(after.plan, before.plan);
    assert.deepEqual(after.document.data.sources, before.document.data.sources);
    assert.notEqual(after.html, before.html);
  }
});

test('mindmap bundles real Markmap once, author data separately, exact CSP and dependency notices; tree stays static', () => {
  const input = hierarchyDocument();
  const root = input.sections[0].blocks[1].root;
  const labels = facts(root);
  const output = compile(input, {
    overrides: { 'architecture-map': 'hierarchy.mindmap' },
    interactive: true,
  });
  assert.equal(
    labels.length,
    (output.html.match(/class="semloom-hierarchy-label"/g) ?? []).length,
  );
  const script = output.html.match(
    /<script data-semloom-mindmap>(.*?)<\/script>/s,
  )[1];
  const payload = JSON.parse(
    output.html.match(
      /<script type="application\/json" id="semloom-mindmap-data">(.*?)<\/script>/s,
    )[1],
  );
  assert.deepEqual(payload.blocks, [{ id: 'architecture-map', root }]);
  assert.ok(payload.licenses.includes('markmap-view 0.18.12'));
  assert.ok(payload.licenses.includes('d3-flextree'));
  assert.ok(payload.licenses.includes('Copyright (c) 2020 Gerald'));
  assert.ok(!script.includes(input.title));
  assert.ok(
    output.html.includes(
      `sha256-${createHash('sha256').update(script).digest('base64')}`,
    ),
  );
  const tree = compile(input).html;
  assert.ok(!tree.includes('<svg'));
  assert.ok(!tree.includes('data-semloom-mindmap'));
  assert.ok(!output.html.includes('data-switcher'));
  assert.equal(
    output.html,
    compile(input, { overrides: { 'architecture-map': 'hierarchy.mindmap' } })
      .html,
  );
});

test('JSON to Markmap recursively escapes literal content, adds leaf arrays and isolates mutable renderer state', () => {
  const root = {
    label: '<b> & " \' **literal**',
    children: [{ label: 'Child' }],
  };
  const before = structuredClone(root);
  const result = toMindmapNode(root);
  assert.deepEqual(result, {
    content: '&lt;b&gt; &amp; &quot; &#39; **literal**',
    children: [{ content: 'Child', children: [] }],
  });
  result.children[0].content = 'changed';
  assert.deepEqual(root, before);
});

test('multiple mindmaps share one embedded renderer with separate block data', () => {
  const input = hierarchyDocument();
  input.sections[0].blocks.push({
    ...structuredClone(input.sections[0].blocks[1]),
    id: 'second-map',
  });
  const output = compile(input, {
    overrides: {
      'architecture-map': 'hierarchy.mindmap',
      'second-map': 'hierarchy.mindmap',
    },
  });
  assert.equal(
    (output.html.match(/<script data-semloom-mindmap>/g) ?? []).length,
    1,
  );
  const payload = JSON.parse(
    output.html.match(/id="semloom-mindmap-data">(.*?)<\/script>/s)[1],
  );
  assert.deepEqual(
    payload.blocks.map((block) => block.id),
    ['architecture-map', 'second-map'],
  );
});

test('mindmap runtime and full notices resolve independently of caller working directory', () => {
  const entry = new URL('../dist/index.js', import.meta.url).href;
  const input = hierarchyDocument();
  const source = `import {compile} from ${JSON.stringify(entry)};const output=compile(${JSON.stringify(input)},{overrides:{'architecture-map':'hierarchy.mindmap'}});console.log(output.html.includes('markmap-view 0.18.12')&&output.html.includes('Copyright (c) 2020 Gerald'));`;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', source],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'true');
});
