import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Independent acceptance requirements: missing entries must not silently
// turn the source or installed browser matrix into a successful no-op.
const expectedIndex = [
  [
    'tools',
    [
      ['cards', 'tools-comparison', 'comparison.cards'],
      ['table', 'tools-comparison', 'comparison.table'],
    ],
  ],
  ['guide', [['default', null, null]]],
  [
    'architecture',
    [
      ['tree', 'architecture-map', 'hierarchy.tree'],
      ['mindmap', 'architecture-map', 'hierarchy.mindmap'],
    ],
  ],
];

// The shipped examples are the input; generated reports never become fixtures.
export function reportWorkflows(
  directory = fileURLToPath(
    new URL('../../examples/report-workflows/', import.meta.url),
  ),
) {
  const read = (name) =>
    JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const cases = read('cases.json');
  assert.deepEqual(
    cases.map((scenario) => [
      scenario.id,
      scenario.variants.map((variant) => [
        variant.id,
        variant.blockId ?? null,
        variant.selected ?? null,
      ]),
    ]),
    expectedIndex,
    'Required report workflow cases or Variants are missing/changed.',
  );
  return cases.map((scenario) => ({
    ...scenario,
    inputFiles: {
      initial: resolve(directory, scenario.initial),
      edited: resolve(directory, scenario.edited),
    },
    initial: read(scenario.initial),
    edited: read(scenario.edited),
    variants: scenario.variants.map((variant) => ({
      ...variant,
      configFile: resolve(directory, variant.config),
      options: read(variant.config),
    })),
  }));
}
