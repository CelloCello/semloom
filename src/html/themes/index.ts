import type { ThemeName, ThemeDefinition } from '../../core/types.js';
import { editorialTokens, editorialMindmapPalette } from './editorial.js';
import { oceanTokens, oceanMindmapPalette } from './ocean.js';
import { graphiteTokens, graphiteMindmapPalette } from './graphite.js';
import { signalTokens, signalMindmapPalette } from './signal.js';
import { midnightTokens, midnightMindmapPalette } from './midnight.js';
import {
  minimalTokens,
  minimalMindmapPalette,
  type MindmapPalette,
  type ThemeTokens,
} from './minimal.js';

export type { ThemeTokens } from './minimal.js';

const themes: Record<
  ThemeName,
  { tokens: Partial<ThemeTokens>; mindmap: MindmapPalette }
> = {
  minimal: { tokens: {}, mindmap: minimalMindmapPalette },
  editorial: { tokens: editorialTokens, mindmap: editorialMindmapPalette },
  ocean: { tokens: oceanTokens, mindmap: oceanMindmapPalette },
  graphite: { tokens: graphiteTokens, mindmap: graphiteMindmapPalette },
  signal: { tokens: signalTokens, mindmap: signalMindmapPalette },
  midnight: { tokens: midnightTokens, mindmap: midnightMindmapPalette },
};

export function resolveTheme(name: ThemeName): ThemeTokens {
  return { ...minimalTokens, ...themes[name].tokens };
}

export function themeCss(name: ThemeName | ThemeDefinition): string {
  const tokens = Object.entries(
    typeof name === 'string'
      ? resolveTheme(name)
      : { ...minimalTokens, ...name.tokens },
  )
    .map(([key, value]) => `--${key}:${value}`)
    .join(';');
  const palette =
    typeof name === 'string'
      ? themes[name].mindmap
      : name.tokens?.['color-scheme'] === 'dark'
        ? midnightMindmapPalette
        : minimalMindmapPalette;
  const branches = palette
    .map((value, i) => `--semloom-mindmap-branch-${i + 1}:${value}`)
    .join(';');
  return `:root{${tokens};${branches}}\n${printThemeCss}`;
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
