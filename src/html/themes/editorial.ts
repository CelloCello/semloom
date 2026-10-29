import type { ThemeTokens, MindmapPalette } from './minimal.js';
export const editorialMindmapPalette: MindmapPalette = [
  '#8d542f',
  '#9a732d',
  '#6f7449',
  '#8c5f60',
  '#776180',
  '#4c7370',
];

// Local fonts only; unspecified tokens inherit the minimal baseline.
export const editorialTokens: Partial<ThemeTokens> = {
  paper: '#f7f1e6',
  ink: '#302a23',
  muted: '#675b4c',
  accent: '#804224',
  line: '#d9cdbb',
  surface: '#fffcf6',
  space: '1.75rem',
  'font-body': 'Georgia,"Songti TC","PMingLiU",serif',
  'font-heading': 'Georgia,"Songti TC","PMingLiU",serif',
  'body-leading': '1.9',
  'title-weight': '600',
  'table-head': '#eee5d6',
  'table-hover': '#f5eddf',
  selection: '#e6ceb0',
};
