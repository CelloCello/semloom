import test from 'node:test';
import childProcess from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { runCli } from '../cli-helpers.mjs';

const log = process.env.SEMLOOM_CANCEL_LOG;
const config = process.env.SEMLOOM_CANCEL_CONFIG;
if (!log || !config)
  throw new Error('Cancellation fixture needs log and config paths.');
const start = Date.now();
let aborted = false;
let count = 0;
const record = (event, fields = {}) =>
  appendFileSync(
    log,
    JSON.stringify({ event, ms: Date.now() - start, aborted, ...fields }) +
      '\n',
  );
const execute = childProcess.execFile;
childProcess.execFile = function (...args) {
  const child = execute.apply(this, args);
  const index = ++count;
  record('spawn', { index, pid: child.pid });
  child.once('close', (code, signal) =>
    record('close', { index, code, signal }),
  );
  return child;
};

// This child test intentionally times out. Its parent test asserts the failure
// and inspects real child close events rather than accepting the timeout alone.
test('timed-out CLI owner', { timeout: 100 }, async (t) => {
  t.signal.addEventListener(
    'abort',
    () => {
      aborted = true;
      record('abort');
    },
    { once: true },
  );
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      runCli(['plugins', 'list', '--config', config], { signal: t.signal }),
    ),
  );
  record('settled', {
    results: results.map((result) => ({
      status: result.status,
      code:
        result.status === 'rejected' ? result.reason.code : result.value.status,
    })),
  });
});
