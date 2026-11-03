import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: { script: string; hash: string; licenses: string } | undefined;
export function bundleCharts() {
  if (cached) return cached;
  const base = fileURLToPath(new URL('../../', import.meta.url));
  const entry = fileURLToPath(new URL('./charts.js', import.meta.url));
  const result = buildSync({
    absWorkingDir: base,
    stdin: {
      contents: `import {enhanceCharts} from ${JSON.stringify(entry)};enhanceCharts();`,
      resolveDir: base,
      sourcefile: 'semloom-charts.js',
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
    Object.values(result.metafile.outputs).some((o) =>
      o.imports.some((i) => i.external),
    )
  )
    throw new Error('Chart bundle has external dependencies.');
  const script = result.outputFiles[0]!.text;
  if (/<\/script/iu.test(script)) throw new Error('Unsafe chart script.');
  const notices = new Map<string, string>();
  const inputs = new Set(
    Object.values(result.metafile.outputs).flatMap((o) =>
      Object.entries(o.inputs)
        .filter(([, i]) => i.bytesInOutput > 0)
        .map(([path]) => path),
    ),
  );
  for (const input of inputs) {
    const file = resolve(base, input);
    if (!file.includes(`${sep}node_modules${sep}`)) continue;
    let directory = dirname(file);
    while (!existsSync(join(directory, 'package.json'))) {
      const parent = dirname(directory);
      if (parent === directory)
        throw new Error('Missing chart dependency metadata.');
      directory = parent;
    }
    const info = JSON.parse(
      readFileSync(join(directory, 'package.json'), 'utf8'),
    ) as { name: string; version: string };
    const key = `${info.name}@${info.version}`;
    if (notices.has(key)) continue;
    const license = [
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'license',
      'license.md',
    ]
      .map((n) => join(directory, n))
      .find(existsSync);
    if (!license) throw new Error(`Missing license for ${info.name}.`);
    const notice = join(directory, 'NOTICE');
    notices.set(
      key,
      `${key}\n${readFileSync(license, 'utf8').trim()}${existsSync(notice) ? '\n' + readFileSync(notice, 'utf8').trim() : ''}`,
    );
  }
  cached = {
    script,
    hash: createHash('sha256').update(script).digest('base64'),
    licenses: [...notices]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, notice]) => notice)
      .join('\n\n'),
  };
  return cached;
}
