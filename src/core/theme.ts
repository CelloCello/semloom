const color = {
  type: 'string',
  pattern: '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$',
};
const length = {
  type: 'string',
  maxLength: 40,
  pattern: '^(?:0|(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:px|rem|em|ch|vw|vh|%))$',
};
const fontName = `(?:[\\p{L}_-][\\p{L}\\p{N}_-]*(?: [\\p{L}\\p{N}_-]+)*|"[\\p{L}\\p{N} _-]+"|'[\\p{L}\\p{N} _-]+')`;
const font = {
  type: 'string',
  maxLength: 500,
  pattern: `^${fontName}(?:,\\s*${fontName})*$`,
};

export const themeTokenSchemas = {
  'color-scheme': { enum: ['light', 'dark'] },
  paper: color,
  ink: color,
  muted: color,
  accent: color,
  line: color,
  surface: color,
  space: length,
  radius: length,
  'font-body': font,
  'font-heading': font,
  'body-leading': { type: 'string', pattern: '^[1-3](?:\\.[0-9]{1,3})?$' },
  'title-weight': { type: 'string', pattern: '^(?:[1-8][0-9]{2}|900)$' },
  measure: length,
  'table-head': color,
  'table-hover': color,
  selection: color,
};
export type ThemeTokens = { [K in keyof typeof themeTokenSchemas]: string };
