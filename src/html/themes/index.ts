import type { ThemeName, ThemeDefinition } from '../../core/types.js';
import {
  editorialTokens,
  editorialMindmapPalette,
  editorialChartPalette,
} from './editorial.js';
import {
  oceanTokens,
  oceanMindmapPalette,
  oceanChartPalette,
} from './ocean.js';
import {
  graphiteTokens,
  graphiteMindmapPalette,
  graphiteChartPalette,
} from './graphite.js';
import {
  signalTokens,
  signalMindmapPalette,
  signalChartPalette,
} from './signal.js';
import {
  midnightTokens,
  midnightMindmapPalette,
  midnightChartPalette,
} from './midnight.js';
import {
  minimalTokens,
  minimalMindmapPalette,
  minimalChartPalette,
  type ChartPalette,
  type MindmapPalette,
  type ThemeTokens,
} from './minimal.js';

export type { ThemeTokens } from './minimal.js';

const themes: Record<
  ThemeName,
  { tokens: Partial<ThemeTokens>; mindmap: MindmapPalette; chart: ChartPalette }
> = {
  minimal: {
    tokens: {},
    mindmap: minimalMindmapPalette,
    chart: minimalChartPalette,
  },
  editorial: {
    tokens: editorialTokens,
    mindmap: editorialMindmapPalette,
    chart: editorialChartPalette,
  },
  ocean: {
    tokens: oceanTokens,
    mindmap: oceanMindmapPalette,
    chart: oceanChartPalette,
  },
  graphite: {
    tokens: graphiteTokens,
    mindmap: graphiteMindmapPalette,
    chart: graphiteChartPalette,
  },
  signal: {
    tokens: signalTokens,
    mindmap: signalMindmapPalette,
    chart: signalChartPalette,
  },
  midnight: {
    tokens: midnightTokens,
    mindmap: midnightMindmapPalette,
    chart: midnightChartPalette,
  },
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

// Selected visual components own separate variables; ordinary reports keep their
// existing stylesheet bytes. External themes inherit by their color scheme.
export function visualThemeCss(name: ThemeName | ThemeDefinition): string {
  const selected =
    typeof name === 'string'
      ? name
      : name.tokens?.['color-scheme'] === 'dark'
        ? 'midnight'
        : 'minimal';
  const tokens =
    typeof name === 'string'
      ? resolveTheme(name)
      : { ...minimalTokens, ...name.tokens };
  const palette = [tokens.accent, ...themes[selected].chart.slice(1)];
  const declarations = (colors: readonly string[]) =>
    colors
      .map((value, i) => `--semloom-chart-series-${i + 1}:${value}`)
      .join(';');
  return `:root{${declarations(palette)}}@media print{:root{${declarations(minimalChartPalette)}}}`;
}

// Component-scoped author overrides outrank inherited root variables. Reset the
// component roles themselves for paper, after external presentation CSS.
export const visualPrintCss = `@media print{
.semloom-chart{${minimalChartPalette.map((color, i) => `--semloom-chart-series-${i + 1}:${color}!important`).join(';')}}
.semloom-diagram{--pele-bg:#fff!important;--pele-fg:#000!important;--pele-muted:#333!important;--pele-line:#000!important;--pele-surface:#eee!important;--pele-surface-alt:#fff!important;--pele-border:#555!important;--pele-accent:#000!important}
}`;

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
