import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = fileURLToPath(new URL('../dist/cli/main.js', import.meta.url));
const waiting = [];
let active = 0;

function abortError(signal) {
  return Object.assign(
    new Error('CLI invocation cancelled.', { cause: signal.reason }),
    {
      name: 'AbortError',
      code: 'ABORT_ERR',
    },
  );
}

function acquire(signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  if (active < 2) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const ticket = {
      grant() {
        signal?.removeEventListener('abort', ticket.cancel);
        resolve();
      },
      cancel() {
        const index = waiting.indexOf(ticket);
        if (index < 0) return;
        waiting.splice(index, 1);
        signal.removeEventListener('abort', ticket.cancel);
        reject(abortError(signal));
      },
    };
    waiting.push(ticket);
    signal?.addEventListener('abort', ticket.cancel, { once: true });
    if (signal?.aborted) ticket.cancel();
  });
}
function release() {
  const next = waiting.shift();
  if (next)
    next.grant(); // Hand the occupied slot directly to the next caller.
  else active--;
}

// Each Node test file has its own process and a pool of at most two CLI children.
export async function runCli(args, { cwd = root, signal } = {}) {
  await acquire(signal);
  try {
    // A grant and cancellation can race before this continuation resumes.
    if (signal?.aborted) throw abortError(signal);
    return await new Promise((resolve, reject) => {
      let callbackComplete = false;
      let closed = false;
      let failure;
      let output;
      function settle() {
        if (!callbackComplete || !closed) return;
        if (signal?.aborted) reject(abortError(signal));
        else if (failure && typeof failure.code !== 'number') reject(failure);
        else resolve({ status: failure?.code ?? 0, ...output });
      }
      const child = childProcess.execFile(
        process.execPath,
        [entry, ...args],
        {
          cwd,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          failure = error;
          output = { stdout, stderr };
          callbackComplete = true;
          settle();
        },
      );
      // A cancelled test must not depend on a Plugin cooperating with SIGTERM.
      const cancel = () => child.kill('SIGKILL');
      signal?.addEventListener('abort', cancel, { once: true });
      // Cover cancellation during launch, before the listener was installed.
      if (signal?.aborted) cancel();
      // A callback may run before process/stdio close (e.g. an execFile error).
      child.once('close', () => {
        signal?.removeEventListener('abort', cancel);
        closed = true;
        settle();
      });
    });
  } finally {
    release();
  }
}
