import type { ThemeName, ThemeDefinition } from '../../core/types.js';
import { editorialTokens } from './editorial.js';
import { oceanTokens } from './ocean.js';
import { graphiteTokens } from './graphite.js';
import { signalTokens } from './signal.js';
import { midnightTokens } from './midnight.js';
import { minimalTokens, type ThemeTokens } from './minimal.js';

export type { ThemeTokens } from './minimal.js';

const themes: Record<ThemeName, Partial<ThemeTokens>> = {
  minimal: {},
  editorial: editorialTokens,
  ocean: oceanTokens,
  graphite: graphiteTokens,
  signal: signalTokens,
  midnight: midnightTokens,
};

export function resolveTheme(name: ThemeName): ThemeTokens {
  return { ...minimalTokens, ...themes[name] };
}

export function themeCss(name: ThemeName | ThemeDefinition): string {
  const tokens = Object.entries(
    typeof name === 'string'
      ? resolveTheme(name)
      : { ...minimalTokens, ...name.tokens },
  )
    .map(([key, value]) => `--${key}:${value}`)
    .join(';');
  return `:root{${tokens}}\n${printThemeCss}`;
}

export const printThemeCss = `
@media print {
  :root {
    --color-scheme: light;
    --paper: #fff;
    --surface: #fff;
    --ink: #000;
    --muted: #333;
    --line: #999;
    --accent: #000;
    --table-head: #eee;
    --table-hover: #fff;
    --selection: #ddd;
  }
}
`;
