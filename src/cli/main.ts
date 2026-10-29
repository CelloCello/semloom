#!/usr/bin/env node
import { readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  compile,
  loadRegistry,
  documentSchema,
  parseConfig,
  resolveDocument,
  planDocument,
  SemloomError,
  limits,
  themeNames,
} from '../index.js';

const help = `Semloom — weave meaning into form

Usage:
  semloom --version
  semloom schema [--config presentation.json]
  semloom validate input.json [--config presentation.json]
  semloom build input.json -o output.html [--config presentation.json]
                [--theme ${themeNames.join('|')}] [--layout document|sidebar] [--explain]
                [--interactive | --no-interactive]
  semloom themes list
  semloom plugins list

Supports prose, comparison, insight, metrics, steps, timeline, richtext, list, code.
Themes: ${themeNames.join(', ')}. Layouts: document, sidebar.
Trusted local plugins: set plugins in --config (paths relative to config file).
Use --interactive for offline Variant switching; default off. --no-interactive overrides config.
Exit codes: 0 success; 2 input/config/validation; 1 compilation/I/O.
`;

async function jsonFile(path: string): Promise<unknown> {
  const bytes = await readFile(path);
  if (bytes.byteLength > limits.inputBytes)
    usage(`Input exceeds ${limits.inputBytes} bytes.`, path);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    usage('Invalid JSON.', path);
  }
}
function usage(message: string, path = '/'): never {
  throw new SemloomError([{ path, code: 'CLI_INPUT', message }]);
}
async function atomicWrite(path: string, content: string): Promise<void> {
  const destination = resolve(path);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        config: { type: 'string' },
        output: { type: 'string', short: 'o' },
        theme: { type: 'string' },
        layout: { type: 'string' },
        explain: { type: 'boolean' },
        interactive: { type: 'boolean' },
        'no-interactive': { type: 'boolean' },
      },
    });
  } catch {
    usage('Unknown or invalid CLI option. Run --help.');
  }
  const { positionals, values } = args;
  if (
    values.interactive !== undefined &&
    values['no-interactive'] !== undefined
  )
    usage('Use either --interactive or --no-interactive.');
  if (values.version) {
    const metadata = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    process.stdout.write(metadata.version + '\n');
    return;
  }
  if (values.help || positionals.length === 0) {
    process.stdout.write(help);
    return;
  }
  const [command, input] = positionals;
  if (!['schema', 'validate', 'build', 'themes', 'plugins'].includes(command!))
    usage('Unknown command. Run --help.');
  if (positionals.length !== (command === 'schema' ? 1 : 2))
    usage('Unexpected or missing command arguments.');
  if (
    command !== 'build' &&
    [
      'output',
      'theme',
      'layout',
      'explain',
      'interactive',
      'no-interactive',
    ].some((key) => values[key] !== undefined)
  )
    usage('Build options are only valid for build.');
  const configFile =
    typeof values.config === 'string' ? values.config : undefined;
  const raw = configFile ? await jsonFile(configFile) : {};
  // Validate file before overrides so unknown or unsupported fields never disappear.
  const base = parseConfig(raw);
  const options = parseConfig({
    ...base,
    ...(values.theme !== undefined ? { theme: values.theme } : {}),
    ...(values.layout !== undefined ? { layout: values.layout } : {}),
    ...(values['no-interactive']
      ? { interactive: false }
      : values.interactive !== undefined
        ? { interactive: values.interactive }
        : {}),
  });
  const registry = await loadRegistry(
    options.plugins,
    configFile ? dirname(resolve(configFile)) : process.cwd(),
  );
  if (command === 'themes' || command === 'plugins') {
    if (input !== 'list') usage('Expected list.');
    process.stdout.write(
      JSON.stringify(
        command === 'themes' ? themeNames : registry.list(),
        null,
        2,
      ) + '\n',
    );
  } else if (command === 'schema') {
    process.stdout.write(
      JSON.stringify(documentSchema(registry), null, 2) + '\n',
    );
  } else {
    const document = await jsonFile(input!);
    if (command === 'validate') {
      planDocument(resolveDocument(document, registry), options, registry);
      process.stdout.write(`${input}: valid\n`);
    } else {
      if (typeof values.output !== 'string')
        usage('build requires -o output.html.');
      if (
        [
          resolve(input!),
          ...(configFile ? [resolve(configFile)] : []),
        ].includes(resolve(values.output))
      )
        usage('Output must not overwrite input or configuration.');
      const result = compile(document, options, registry);
      if (values.explain)
        process.stderr.write(JSON.stringify(result.plan, null, 2) + '\n');
      await atomicWrite(values.output, result.html);
      process.stderr.write(`Built ${values.output}\n`);
    }
  }
}
main().catch((error: unknown) => {
  if (error instanceof SemloomError) {
    // Include file context as well as bounded JSON-pointer diagnostics.
    process.stderr.write(
      `${process.argv.slice(2, 6).join(' ')}\n${error.message}\n`,
    );
    process.exitCode = error.exitCode;
  } else {
    const code =
      error instanceof Error && 'code' in error
        ? String(error.code)
        : 'COMPILATION_FAILED';
    process.stderr.write(
      `[${code}] ${error instanceof Error ? error.message.slice(0, 240) : 'Operation failed.'}\n`,
    );
    process.exitCode = 1;
  }
});
