import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.argv.slice(2).some((argument) => argument !== '--package'))
  throw new Error('Unknown build option.');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
const args = [
  resolve(root, 'node_modules/typescript/bin/tsc'),
  '-p',
  'tsconfig.json',
];
// Packed browser entries must not reference omitted .map files during bundling.
if (process.argv.includes('--package')) args.push('--sourceMap', 'false');
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
