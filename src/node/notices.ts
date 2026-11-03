import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
export function peleNotice(): string {
  const base = dirname(require.resolve('pele/package.json'));
  return `Pele 1.13.0\n${readFileSync(join(base, 'LICENSE'), 'utf8').trim()}`;
}
