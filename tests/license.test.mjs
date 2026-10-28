import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile } from '../dist/index.js';
import { runtimeLicenseText } from '../dist/html/license.js';
import { research } from './helpers.mjs';

test('generated HTML preserves the approved runtime license without altering report data', () => {
  assert.equal(
    runtimeLicenseText,
    readFileSync(new URL('../LICENSE', import.meta.url), 'utf8').trim(),
  );
  const output = compile(research, { interactive: true });
  assert.deepEqual(output.document.data, research);
  assert.ok(
    output.html.includes(
      `<!-- Semloom runtime license (report content is separate)\n${runtimeLicenseText}\n-->`,
    ),
  );
});
