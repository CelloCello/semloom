// The minimal theme also supplies fallback tokens for every built-in Theme.
import type { ThemeTokens } from '../../core/theme.js';
export type MindmapPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
];
export const minimalMindmapPalette: MindmapPalette = [
  '#237747',
  '#2463b5',
  '#ad590f',
  '#8545b3',
  '#b3374f',
  '#857000',
];
export const minimalTokens: ThemeTokens = {
  'color-scheme': 'light',
  paper: '#faf9f6',
  ink: '#242923',
  muted: '#586255',
  accent: '#285744',
  line: '#d8ddd4',
  surface: '#fff',
  space: '1.5rem',
  radius: '12px',
  'font-body':
    'system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif',
  'font-heading':
    'system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif',
  'body-leading': '1.75',
  'title-weight': '650',
  measure: '72ch',
  'table-head': '#eef1eb',
  'table-hover': '#f5f7f2',
  selection: '#cde2d3',
};

export type { ThemeTokens } from '../../core/theme.js';
