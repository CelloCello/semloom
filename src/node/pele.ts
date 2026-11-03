import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let engine: typeof import('pele') | undefined;
export function diagramEngine(): typeof import('pele') {
  return (engine ??= require('pele') as typeof import('pele'));
}
