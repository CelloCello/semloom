import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: resolve('.cache/ms-playwright'),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
