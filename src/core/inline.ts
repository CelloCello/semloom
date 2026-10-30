import type { InlineRun, JsonSchema } from './types.js';
import { fail } from './types.js';
import { validateUrlReference } from './url.js';

export const inlineLimits = {
  runs: 1000,
  text: 100000,
  url: 4000,
} as const;

// Inline the schema so it remains valid both alone and inside any kind schema.
export function inlineContentSchema(): JsonSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: inlineLimits.runs,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1, maxLength: inlineLimits.text },
        marks: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          uniqueItems: true,
          items: { enum: ['strong', 'emphasis', 'code'] },
        },
        href: { type: 'string', minLength: 1, maxLength: inlineLimits.url },
      },
    },
  };
}

// Structural validation runs first; references need the complete resolved ID set.
export function validateInlineContent(
  content: readonly InlineRun[],
  path: string,
  anchors: ReadonlySet<string>,
): void {
  let length = 0;
  for (const [index, run] of content.entries()) {
    // Match JSON Schema maxLength's Unicode code-point counting.
    length += [...run.text].length;
    if (length > inlineLimits.text)
      fail(
        `${path}/${index}/text`,
        'INLINE_LIMIT',
        `Inline content exceeds ${inlineLimits.text} characters in total.`,
      );
    if (run.href !== undefined)
      validateUrlReference(run.href, `${path}/${index}/href`, anchors);
  }
}
