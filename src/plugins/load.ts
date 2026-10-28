import { isAbsolute, resolve, extname, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRegistry } from './builtin.js';
import {
  SemloomError,
  fail,
  type Plugin,
  type Variant,
} from '../core/types.js';

export async function loadRegistry(
  paths: readonly string[],
  baseDirectory = process.cwd(),
) {
  const plugins: Plugin[] = [];
  for (const [index, path] of paths.entries()) {
    if (
      typeof path !== 'string' ||
      (!isAbsolute(path) &&
        !path.startsWith('./') &&
        !path.startsWith('../')) ||
      !['.js', '.mjs', '.cjs'].includes(extname(path))
    )
      fail(
        `/plugins/${index}`,
        'PLUGIN_PATH',
        'Expected an explicit local .js/.mjs/.cjs module path.',
      );
    const file = resolve(baseDirectory, path);
    try {
      const module = (await import(pathToFileURL(file).href)) as {
        default?: unknown;
      };
      // Registry validates the runtime export, including functions, schemas and versions.
      plugins.push(
        resolveBrowserEntries(module.default as Plugin, dirname(file)),
      );
    } catch {
      fail(
        `/plugins/${index}`,
        'PLUGIN_LOAD',
        `Cannot import local plugin ${file}.`,
      );
    }
  }
  try {
    return createRegistry(plugins);
  } catch (error) {
    if (error instanceof SemloomError)
      throw new SemloomError(
        error.diagnostics.map((d) => ({
          ...d,
          path: `/plugins${d.path === '/' ? '' : d.path}`,
        })),
      );
    throw error;
  }
}

function resolveBrowserEntries(plugin: Plugin, base: string): Plugin {
  if (!plugin || typeof plugin !== 'object') return plugin;
  function variant(view: Variant): Variant {
    if (
      !view ||
      typeof view !== 'object' ||
      !view.browser ||
      typeof view.browser !== 'object' ||
      Array.isArray(view.browser) ||
      typeof view.browser.entry !== 'string'
    )
      return view;
    const entry = view.browser.entry;
    if (!entry.startsWith('./') && !entry.startsWith('../')) return view;
    return {
      ...view,
      browser: { ...view.browser, entry: resolve(base, entry) },
    };
  }
  return {
    ...plugin,
    ...(Array.isArray(plugin.kinds)
      ? {
          kinds: plugin.kinds.map((kind) =>
            kind && typeof kind === 'object' && Array.isArray(kind.variants)
              ? { ...kind, variants: kind.variants.map(variant) }
              : kind,
          ),
        }
      : {}),
    ...(Array.isArray(plugin.extensions)
      ? {
          extensions: plugin.extensions.map((extension) =>
            extension &&
            typeof extension === 'object' &&
            Array.isArray(extension.variants)
              ? { ...extension, variants: extension.variants.map(variant) }
              : extension,
          ),
        }
      : {}),
  };
}
