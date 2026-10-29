import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Bundle {
  script: string;
  hash: string;
  licenses: string;
}
let cached: Bundle | undefined;
export function bundleMindmap(): Bundle {
  if (cached) return cached;
  const base = fileURLToPath(new URL('../../', import.meta.url));
  const entry = fileURLToPath(new URL('./mindmap.js', import.meta.url));
  const result = buildSync({
    absWorkingDir: base,
    stdin: {
      contents: `import {enhanceMindmaps} from ${JSON.stringify(entry)};enhanceMindmaps();`,
      resolveDir: base,
      sourcefile: 'semloom-mindmap.js',
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
      output.imports.some((item) => item.external),
    )
  )
    throw new Error('Mindmap bundle has external browser dependencies.');
  const script = result.outputFiles[0]!.text;
  if (/<\/script/iu.test(script))
    throw new Error('Unsafe inline mindmap script.');
  const notices = new Map<string, string>([
    [
      'd3-flextree',
      readFileSync(
        new URL('../../docs/licenses/d3-flextree.txt', import.meta.url),
        'utf8',
      ).trim(),
    ],
  ]);
  const inputs = new Set(
    Object.values(result.metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([path]) => path),
    ),
  );
  for (const input of inputs) {
    const file = resolve(base, input);
    if (!file.includes(`${sep}node_modules${sep}`)) continue;
    let directory = dirname(file);
    while (!existsSync(join(directory, 'package.json'))) {
      const parent = dirname(directory);
      if (parent === directory) throw new Error('Missing dependency metadata.');
      directory = parent;
    }
    const info = JSON.parse(
      readFileSync(join(directory, 'package.json'), 'utf8'),
    ) as { name: string; version: string };
    if (directory === resolve(base)) continue;
    const key = `${info.name}@${info.version}`;
    if (notices.has(key)) continue;
    const license = [
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'license',
      'license.md',
    ]
      .map((name) => join(directory, name))
      .find(existsSync);
    if (!license) throw new Error(`Missing embedded license for ${info.name}.`);
    notices.set(
      key,
      `${info.name} ${info.version}\n${readFileSync(license, 'utf8').trim()}`,
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
