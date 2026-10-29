import { checkSchema } from './schema.js';
import { assetCatalog } from './assets.js';
import { themeTokenSchemas } from './theme.js';
import { transformSync } from 'esbuild';
import {
  fail,
  layoutNames,
  themeNames,
  type ThemeDefinition,
  type LayoutDefinition,
  type PresentationNames,
  type ResolvedPresentation,
} from './types.js';

const id = { type: 'string', maxLength: 100, pattern: '^[a-z][a-z0-9.-]*$' };
const css = { type: 'string', maxLength: 200000 };
export const themeDefinitionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'themeApiVersion'],
  properties: {
    id,
    themeApiVersion: { const: '1.0' },
    tokens: {
      type: 'object',
      additionalProperties: false,
      properties: themeTokenSchemas,
    },
    css,
  },
};
export const layoutDefinitionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'layoutApiVersion', 'base'],
  properties: {
    id,
    layoutApiVersion: { const: '1.0' },
    base: { enum: [...layoutNames] },
    css,
  },
};

export class PresentationCatalog {
  readonly #themes = new Map<string, ThemeDefinition>();
  readonly #layouts = new Map<string, LayoutDefinition>();
  readonly sourceFiles: readonly string[];
  constructor(input: unknown = {}, sourceFiles: readonly string[] = []) {
    checkSchema<{ themes?: ThemeDefinition[]; layouts?: LayoutDefinition[] }>(
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          themes: { type: 'array', maxItems: 50, items: themeDefinitionSchema },
          layouts: {
            type: 'array',
            maxItems: 50,
            items: layoutDefinitionSchema,
          },
        },
      },
      input,
    );
    for (const [category, builtins, definitions, target] of [
      ['themes', themeNames, input.themes ?? [], this.#themes],
      ['layouts', layoutNames, input.layouts ?? [], this.#layouts],
    ] as const) {
      for (const [index, definition] of definitions.entries()) {
        if (
          (builtins as readonly string[]).includes(definition.id) ||
          target.has(definition.id)
        )
          fail(
            `/${category}/${index}/id`,
            'PRESENTATION_CONFLICT',
            `Duplicate or reserved ${category} ID ${definition.id}.`,
          );
        if (definition.css !== undefined) {
          try {
            assetCatalog([
              {
                id: `${category}.${definition.id}`,
                type: 'css',
                content: definition.css,
              },
            ]);
            const result = transformSync(definition.css, {
              loader: 'css',
              logLevel: 'silent',
            });
            if (result.warnings.length) throw new Error('Invalid CSS.');
          } catch {
            fail(
              `/${category}/${index}/css`,
              'PRESENTATION_CSS',
              'CSS must follow the bounded, offline static asset contract.',
            );
          }
        }
        // Maps remain private and getters return clones, including nested token data.
        if (category === 'themes')
          this.#themes.set(
            definition.id,
            structuredClone(definition as ThemeDefinition),
          );
        else
          this.#layouts.set(
            definition.id,
            structuredClone(definition as LayoutDefinition),
          );
      }
    }
    this.sourceFiles = Object.freeze([...sourceFiles]);
    Object.freeze(this);
  }
  names(): PresentationNames {
    return {
      themes: [...themeNames, ...[...this.#themes.keys()].sort()],
      layouts: [...layoutNames, ...[...this.#layouts.keys()].sort()],
    };
  }
  resolve(theme: string, layout: string): ResolvedPresentation {
    const selectedTheme = this.#themes.get(theme);
    const selectedLayout = this.#layouts.get(layout);
    if (!selectedTheme && !(themeNames as readonly string[]).includes(theme))
      fail('/theme', 'UNKNOWN_THEME', `Unknown Theme ${theme}.`);
    if (!selectedLayout && !(layoutNames as readonly string[]).includes(layout))
      fail('/layout', 'UNKNOWN_LAYOUT', `Unknown Layout ${layout}.`);
    return {
      base: selectedLayout?.base ?? (layout as 'document' | 'sidebar'),
      ...(selectedTheme ? { theme: structuredClone(selectedTheme) } : {}),
      ...(selectedLayout ? { layout: structuredClone(selectedLayout) } : {}),
    };
  }
}
export function createPresentation(input: unknown = {}): PresentationCatalog {
  return new PresentationCatalog(input);
}
