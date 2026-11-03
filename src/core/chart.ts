import { fail, type ChartBlock, type JsonSchema } from './types.js';

export const chartLimits = {
  categories: 100,
  series: 6,
  values: 600,
  documentValues: 3000,
} as const;
const text = (maxLength: number) => ({
  type: 'string',
  minLength: 1,
  maxLength,
});
const identity = { key: text(100), label: text(200) };
export const chartSchema: JsonSchema = {
  type: 'object',
  required: ['title', 'chartType', 'categories', 'series'],
  properties: {
    title: text(200),
    description: text(2000),
    unit: text(40),
    chartType: { enum: ['bar', 'line', 'donut'] },
    orientation: { enum: ['vertical', 'horizontal'] },
    categories: {
      type: 'array',
      minItems: 1,
      maxItems: chartLimits.categories,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label'],
        properties: identity,
      },
    },
    series: {
      type: 'array',
      minItems: 1,
      maxItems: chartLimits.series,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label', 'values'],
        properties: {
          ...identity,
          values: {
            type: 'array',
            minItems: 1,
            maxItems: chartLimits.categories,
            items: { type: ['number', 'null'] },
          },
        },
      },
    },
  },
};

export function validateChart(block: ChartBlock, path: string): number {
  for (const field of ['categories', 'series'] as const) {
    const keys = new Set<string>();
    for (const [i, item] of block[field].entries()) {
      if (keys.has(item.key))
        fail(
          `${path}/${field}/${i}/key`,
          'CHART_DUPLICATE_KEY',
          'Keys must be unique within categories or series.',
        );
      keys.add(item.key);
    }
  }
  if (block.chartType !== 'bar' && block.orientation !== undefined)
    fail(
      `${path}/orientation`,
      'CHART_ORIENTATION',
      'Only bar charts accept orientation.',
    );
  let provided = false;
  let total = 0;
  for (const [i, series] of block.series.entries()) {
    if (series.values.length !== block.categories.length)
      fail(
        `${path}/series/${i}/values`,
        'CHART_VALUES_LENGTH',
        'Values must align exactly with the ordered categories.',
      );
    for (const [j, value] of series.values.entries()) {
      if (value !== null && !Number.isFinite(value))
        fail(
          `${path}/series/${i}/values/${j}`,
          'CHART_VALUE',
          'Values must be finite numbers or null.',
        );
      provided ||= value !== null;
      if (block.chartType === 'donut') {
        if (value === null || value < 0)
          fail(
            `${path}/series/${i}/values/${j}`,
            'CHART_DONUT_VALUE',
            'Donut values must be non-negative finite numbers.',
          );
        total += value;
      }
    }
  }
  if (!provided)
    fail(
      `${path}/series`,
      'CHART_NO_VALUES',
      'Provide at least one value; null means not provided, never zero.',
    );
  if (block.chartType === 'donut') {
    if (block.series.length !== 1)
      fail(
        `${path}/series`,
        'CHART_DONUT_SERIES',
        'Donut charts require exactly one series.',
      );
    if (block.categories.length > 6)
      fail(
        `${path}/categories`,
        'CHART_DONUT_CATEGORIES',
        'Donut charts allow at most six categories.',
      );
    if (!Number.isFinite(total) || total <= 0)
      fail(
        `${path}/series/0/values`,
        'CHART_DONUT_TOTAL',
        'Donut totals must be finite and greater than zero.',
      );
  }
  return block.categories.length * block.series.length;
}

// Encode every UTF-16 code unit: injective, deterministic, no dictionary magic keys.
export function chartName(key: string): string {
  return (
    'semloom-key-' +
    Array.from({ length: key.length }, (_, i) =>
      key.charCodeAt(i).toString(16).padStart(4, '0'),
    ).join('')
  );
}
