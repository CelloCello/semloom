import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { isAbsolute, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, SemloomError } from '../core/types.js';
import type { InteractivePlan } from './types.js';

export function bundleInteractive(
  plan: InteractivePlan,
): { script: string; hash: string } | undefined {
  if (!plan.blocks.length) return;
  const entries = [...plan.adapters].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [id, adapter] of entries) {
    if (
      !isAbsolute(adapter.entry) ||
      !['.js', '.mjs', '.cjs', '.ts'].includes(extname(adapter.entry))
    )
      fail(
        '/',
        'BROWSER_ENTRY',
        `Adapter ${id} needs an absolute local JS/TS entry (loadRegistry resolves relative entries).`,
      );
  }
  const imports = entries.map(
    ([, adapter], i) =>
      `import {${adapter.exportName} as adapter${i}} from ${JSON.stringify(adapter.entry)};`,
  );
  const runtime = fileURLToPath(new URL('./runtime.js', import.meta.url));
  let script: string;
  try {
    const result = buildSync({
      stdin: {
        contents: `${imports.join('\n')}\nimport {enhanceVariants} from ${JSON.stringify(runtime)};\nenhanceVariants(new Map([${entries.map(([id], i) => `[${JSON.stringify(id)},adapter${i}]`).join(',')}]));`,
        resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
        sourcefile: 'semloom-interactive.js',
      },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: 'es2022',
      minify: true,
      charset: 'ascii',
      legalComments: 'none',
      write: false,
      metafile: true,
      logLevel: 'silent',
      supported: { 'inline-script': true },
    });
    if (
      result.warnings.length ||
      result.outputFiles.length !== 1 ||
      Object.values(result.metafile.outputs).some((output) =>
        output.imports.some((entry) => entry.external),
      )
    )
      throw new Error('Unresolved or external browser dependency.');
    script = result.outputFiles[0]!.text;
    if (/<\/script/iu.test(script)) throw new Error('Unsafe inline script.');
  } catch {
    throw new SemloomError(
      [
        {
          path: '/',
          code: 'BROWSER_BUNDLE',
          message:
            'Cannot bundle browser adapters: use existing named exports and local, browser-compatible static imports only.',
        },
      ],
      1,
    );
  }
  return { script, hash: createHash('sha256').update(script).digest('base64') };
}

export function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/gu,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
