import { resolveDocument } from './core/document.js';
import { planDocument } from './core/planner.js';
import type { Registry } from './core/registry.js';
import { parseConfig } from './core/schema.js';
import { renderDocument } from './html/render.js';
import { createRegistry } from './plugins/builtin.js';
import { fail } from './core/types.js';
import {
  createPresentation,
  type PresentationCatalog,
} from './core/presentation.js';

export function compile(
  input: unknown,
  options: unknown = {},
  registry?: Registry,
  presentation?: PresentationCatalog,
) {
  const config = parseConfig(options, presentation?.names());
  if ((config.themes.length || config.layouts.length) && !presentation)
    fail(
      '/',
      'PRESENTATION_LOADING_REQUIRED',
      'Use loadPresentation(config, baseDirectory) and pass its catalog as compile() fourth argument.',
    );
  const resolved = (presentation ?? createPresentation()).resolve(
    config.theme,
    config.layout,
  );
  if (config.plugins.length && !registry)
    fail(
      '/plugins',
      'PLUGIN_LOADING_REQUIRED',
      'Use loadRegistry(config.plugins, baseDirectory) and pass the loaded Registry to compile.',
    );
  const effectiveRegistry = registry ?? createRegistry();
  effectiveRegistry.freeze();
  const document = resolveDocument(input, effectiveRegistry);
  const plan = planDocument(document, config, effectiveRegistry, resolved.base);
  return {
    html: renderDocument(
      document,
      plan,
      effectiveRegistry,
      config.theme,
      config.interactive,
      resolved,
    ),
    plan,
    document,
  };
}
export { createRegistry, resolveDocument, planDocument, parseConfig };
export { documentSchema, limits } from './core/schema.js';
export { inlineLimits } from './core/inline.js';
export { listLimits } from './core/list.js';
export { codeLimits } from './core/code.js';
export { Registry } from './core/registry.js';
export { SemloomError, themeNames, layoutNames } from './core/types.js';
export type * from './core/types.js';
export { html, heading } from './html/html.js';
export { safeUrl } from './core/url.js';
export { loadRegistry } from './plugins/load.js';
export {
  createPresentation,
  PresentationCatalog,
} from './core/presentation.js';
export { loadPresentation } from './presentation/load.js';
