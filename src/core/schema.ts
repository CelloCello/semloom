import { Ajv, type ErrorObject } from 'ajv';
import type { Registry } from './registry.js';
import {
  SemloomError,
  themeNames,
  layoutNames,
  type Config,
  type JsonSchema,
} from './types.js';

export const limits = {
  depth: 8,
  sections: 200,
  blocks: 1000,
  inputBytes: 5_000_000,
} as const;
const id = {
  type: 'string',
  minLength: 1,
  maxLength: 200,
  pattern: '^(?!semloom-)[^\\s\\u0000-\\u001f\\u007f]+$',
};
const label = { type: 'string', minLength: 1, maxLength: 1000 };
const envelope = {
  id,
  sourceIds: { type: 'array', maxItems: 100, uniqueItems: true, items: id },
};
export function documentSchema(registry: Registry): JsonSchema {
  const definitions: Record<string, unknown> = {};
  const kinds = registry.definitions();
  definitions.block = {
    oneOf: kinds.map((kind) => ({
      ...kind.schema,
      additionalProperties: false,
      properties: {
        ...(kind.schema.properties as object),
        ...envelope,
        kind: { const: kind.kind },
      },
      required: [
        'kind',
        ...((kind.schema.required as string[] | undefined) ?? []),
      ],
    })),
  };
  for (let depth = 0; depth < limits.depth; depth++) {
    definitions[`section${depth}`] = {
      type: 'object',
      additionalProperties: false,
      required: ['title'],
      properties: {
        id,
        title: label,
        blocks: {
          type: 'array',
          maxItems: limits.blocks,
          items: { $ref: '#/definitions/block' },
        },
        sections:
          depth === limits.depth - 1
            ? { type: 'array', maxItems: 0 }
            : {
                type: 'array',
                maxItems: limits.sections,
                items: { $ref: `#/definitions/section${depth + 1}` },
              },
      },
    };
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://semloom.local/schema/document-1.0.json',
    title: 'Semloom Document 1.0',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'title', 'sections'],
    properties: {
      schemaVersion: { const: '1.0' },
      title: label,
      locale: {
        type: 'string',
        maxLength: 40,
        pattern: '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$',
      },
      sources: {
        type: 'array',
        maxItems: 200,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title'],
          properties: {
            id,
            title: label,
            url: { type: 'string', minLength: 1, maxLength: 4000 },
          },
        },
      },
      sections: {
        type: 'array',
        minItems: 1,
        maxItems: limits.sections,
        items: { $ref: '#/definitions/section0' },
      },
    },
    definitions,
  };
}

export function checkSchema<T>(
  schema: JsonSchema,
  input: unknown,
): asserts input is T {
  const validate = new Ajv({
    strict: true,
    strictNumbers: true,
    allErrors: true,
    ownProperties: true,
  }).compile<T>(schema);
  if (!validate(input)) {
    // Keep only the branch for this block's kind, rather than unrelated oneOf errors.
    const errors = validate.errors ?? [];
    const choices = ((
      schema.definitions as Record<string, JsonSchema> | undefined
    )?.block?.oneOf ?? []) as JsonSchema[];
    const supportedKinds = choices.map(
      (choice) => (choice.properties as Record<string, JsonSchema>).kind!.const,
    );
    const diagnostics = errors.flatMap((error) => {
      if (error.keyword === 'oneOf') return [];
      const branch = /\/block\/oneOf\/(\d+)\//u.exec(error.schemaPath);
      if (branch) {
        const kind = enclosingKind(input, error.instancePath);
        if (kind !== undefined && !supportedKinds.includes(kind)) {
          return error.keyword === 'const'
            ? [
                {
                  path: error.instancePath,
                  code: 'UNKNOWN_KIND',
                  message: `Unsupported kind ${JSON.stringify(kind).slice(0, 100)}.`,
                },
              ]
            : [];
        }
        if (kind !== undefined && supportedKinds[Number(branch[1])] !== kind)
          return [];
      }
      return [diagnostic(error)];
    });
    const unique = [
      ...new Map(diagnostics.map((d) => [`${d.path}:${d.code}`, d])).values(),
    ];
    throw new SemloomError(unique.slice(0, 12));
  }
}
function enclosingKind(input: unknown, path: string): unknown {
  let value = input;
  const parts = path.split('/').slice(1);
  for (const [index, part] of parts.entries()) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<string, unknown>)[
      part.replace(/~1/g, '/').replace(/~0/g, '~')
    ];
    // The discriminator belongs to the outer Block, never a nested content field.
    if (parts[index - 1] === 'blocks' && /^\d+$/u.test(part)) {
      return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>).kind
        : undefined;
    }
  }
  return undefined;
}
function diagnostic(error: ErrorObject) {
  const extra =
    error.keyword === 'additionalProperties'
      ? String(error.params.additionalProperty)
      : error.keyword === 'required'
        ? String(error.params.missingProperty)
        : '';
  return {
    path: `${error.instancePath}/${extra}`.replace(/\/$/, '') || '/',
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    message: `${error.message ?? 'Invalid value'}${extra ? ` (${JSON.stringify(extra).slice(0, 100)})` : ''}`,
  };
}

const configSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    theme: { enum: [...themeNames] },
    layout: { enum: [...layoutNames] },
    interactive: { type: 'boolean' },
    plugins: {
      type: 'array',
      maxItems: 50,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 4000 },
    },
    overrides: {
      type: 'object',
      maxProperties: limits.blocks,
      additionalProperties: { type: 'string', minLength: 1, maxLength: 200 },
    },
  },
};
export function parseConfig(input: unknown = {}): Config {
  checkSchema<Partial<Config>>(configSchema, input);
  return {
    theme: input.theme ?? 'minimal',
    layout: input.layout ?? 'document',
    interactive: input.interactive ?? false,
    overrides: { ...input.overrides },
    plugins: [...(input.plugins ?? [])],
  };
}
export { safeUrl } from './url.js';
