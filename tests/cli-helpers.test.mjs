import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter, getEventListeners } from 'node:events';
import { setImmediate as tick } from 'node:timers/promises';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from './cli-helpers.mjs';

test('CLI pool limits children to two, preserves exit output and releases slots after launch failures', async (t) => {
  let active = 0;
  let peak = 0;
  const launched = [];
  t.mock.method(
    childProcess,
    'execFile',
    (_binary, args, _options, callback) => {
      const index = Number(args[1]);
      if (index === 7)
        throw Object.assign(new Error('synchronous launch failure'), {
          code: 'EACCES',
        });
      const child = new EventEmitter();
      launched.push(index);
      peak = Math.max(peak, ++active);
      setImmediate(() => {
        const error =
          index === 1
            ? Object.assign(new Error('validation failed'), { code: 2 })
            : index === 2
              ? Object.assign(new Error('launch failed'), { code: 'ENOENT' })
              : null;
        callback(error, `stdout-${index}`, `stderr-${index}`);
        // Abort/error callbacks can precede actual child/stdio closure.
        setImmediate(() => {
          active--;
          child.emit('close');
        });
      });
      return child;
    },
  );
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) => runCli([String(index)])),
  );
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(launched, [0, 1, 2, 3, 4, 5]);
  for (const index of [0, 1, 3, 4, 5]) {
    assert.equal(results[index].status, 'fulfilled');
    assert.deepEqual(results[index].value, {
      status: index === 1 ? 2 : 0,
      stdout: `stdout-${index}`,
      stderr: `stderr-${index}`,
    });
  }
  assert.equal(results[2].status, 'rejected');
  assert.equal(results[2].reason.code, 'ENOENT');
  await assert.rejects(runCli(['7']), { code: 'EACCES' });
  assert.equal((await runCli(['6'])).status, 0);
  assert.equal(active, 0);
});

test('CLI cancellation removes queued work and holds active slots until close without cancelling other owners', async (t) => {
  const children = new Map();
  const duringLaunch = new AbortController();
  const launched = [];
  let active = 0;
  let peak = 0;
  t.mock.method(
    childProcess,
    'execFile',
    (_binary, args, _options, callback) => {
      const index = Number(args[1]);
      const child = new EventEmitter();
      let delivered = false;
      let closed = false;
      const deliver = (error) => {
        if (delivered) return;
        delivered = true;
        callback(error, `stdout-${index}`, `stderr-${index}`);
      };
      child.kill = (signal) => {
        assert.equal(signal, 'SIGKILL');
        deliver(Object.assign(new Error('killed'), { signal }));
        return true;
      };
      child.close = () => {
        if (closed) return;
        closed = true;
        active--;
        child.emit('close');
      };
      child.finish = () => {
        deliver(null);
        child.close();
      };
      children.set(index, child);
      launched.push(index);
      peak = Math.max(peak, ++active);
      if (index === 4) duringLaunch.abort();
      return child;
    },
  );
  const preCancelled = new AbortController();
  preCancelled.abort();
  await assert.rejects(runCli(['never'], { signal: preCancelled.signal }), {
    code: 'ABORT_ERR',
  });
  const raced = new AbortController();
  const granted = runCli(['never'], { signal: raced.signal });
  raced.abort();
  await assert.rejects(granted, { code: 'ABORT_ERR' });
  assert.deepEqual(launched, []);

  const owner = new AbortController();
  const other = new AbortController();
  const jobs = [0, 1, 2, 3].map((index) =>
    runCli([String(index)], {
      signal: index === 3 ? other.signal : owner.signal,
    }),
  );
  const completed = Promise.allSettled(jobs);
  let settled = false;
  completed.then(() => {
    settled = true;
  });
  t.after(async () => {
    owner.abort();
    other.abort();
    for (let i = 0; i < 4; i++) {
      for (const child of children.values()) child.finish();
      await tick();
    }
    await completed;
  });
  await tick();
  assert.deepEqual(launched, [0, 1]);
  owner.abort();
  await tick();
  await assert.rejects(jobs[2], { code: 'ABORT_ERR' });
  assert.deepEqual(
    launched,
    [0, 1],
    'Callbacks must not release slots before close.',
  );
  assert.equal(settled, false);
  assert.equal(active, 2);
  children.get(0).close();
  await tick();
  assert.deepEqual(
    launched,
    [0, 1, 3],
    'Another owner keeps its FIFO position.',
  );
  assert.equal(active, 2);
  other.abort();
  await tick();
  assert.equal(settled, false);
  children.get(1).close();
  children.get(3).close();
  const results = await completed;
  assert.ok(
    results.every(
      (result) =>
        result.status === 'rejected' && result.reason.code === 'ABORT_ERR',
    ),
  );
  assert.equal(active, 0);
  assert.equal(peak, 2);
  assert.equal(getEventListeners(owner.signal, 'abort').length, 0);
  assert.equal(getEventListeners(other.signal, 'abort').length, 0);
  const launching = runCli(['4'], { signal: duringLaunch.signal });
  const rejected = assert.rejects(launching, { code: 'ABORT_ERR' });
  await tick();
  assert.equal(active, 1);
  children.get(4).close();
  await rejected;
  assert.equal(active, 0);
  assert.equal(getEventListeners(duringLaunch.signal, 'abort').length, 0);
});

test('timed-out CLI owner cancels queued children and settles only after real child close', () => {
  const directory = mkdtempSync(join(tmpdir(), 'semloom-cli-cancel-'));
  const log = join(directory, 'events.jsonl');
  const config = join(directory, 'config.json');
  writeFileSync(
    config,
    JSON.stringify({
      plugins: [
        fileURLToPath(
          new URL('./fixtures/slow-cli-plugin.mjs', import.meta.url),
        ),
      ],
    }),
  );
  try {
    const env = {
      ...process.env,
      SEMLOOM_CANCEL_LOG: log,
      SEMLOOM_CANCEL_CONFIG: config,
    };
    // Start an independent runner, not a recursive child of this test runner.
    delete env.NODE_TEST_CONTEXT;
    const result = childProcess.spawnSync(
      process.execPath,
      [
        '--test',
        fileURLToPath(
          new URL('./fixtures/cli-cancellation.mjs', import.meta.url),
        ),
      ],
      { encoding: 'utf8', timeout: 15000, env },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /timed out/);
    const events = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    const spawns = events.filter((event) => event.event === 'spawn');
    const closes = events.filter((event) => event.event === 'close');
    assert.equal(
      spawns.length,
      2,
      'Cancelled queued children must never launch.',
    );
    assert.ok(spawns.every((event) => !event.aborted));
    assert.equal(closes.length, 2);
    assert.ok(
      closes.every((event) => event.aborted && event.signal === 'SIGKILL'),
    );
    assert.deepEqual(closes.map((event) => event.index).sort(), [1, 2]);
    assert.equal(
      events.at(-1).event,
      'settled',
      'Promises must wait for both close events.',
    );
    assert.deepEqual(
      events.at(-1).results,
      Array.from({ length: 4 }, () => ({
        status: 'rejected',
        code: 'ABORT_ERR',
      })),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
