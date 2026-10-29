import type { ThemeTokens } from './theme.js';
export type { ThemeTokens } from './theme.js';
export type JsonSchema = Record<string, unknown>;
export type Cell = string | number | boolean | null;
export const themeNames = [
  'minimal',
  'editorial',
  'ocean',
  'graphite',
  'signal',
  'midnight',
] as const;
export const layoutNames = ['document', 'sidebar'] as const;
export type ThemeName = (typeof themeNames)[number];
export type LayoutName = (typeof layoutNames)[number];
export interface ThemeDefinition {
  id: string;
  themeApiVersion: '1.0';
  tokens?: Partial<ThemeTokens>;
  css?: string;
}
export interface LayoutDefinition {
  id: string;
  layoutApiVersion: '1.0';
  base: LayoutName;
  css?: string;
}
export interface PresentationNames {
  themes: readonly string[];
  layouts: readonly string[];
}
export interface ResolvedPresentation {
  base: LayoutName;
  theme?: ThemeDefinition;
  layout?: LayoutDefinition;
}

export interface Block {
  id?: string;
  kind: string;
  sourceIds?: string[];
  [key: string]: unknown;
}
export interface ProseBlock extends Block {
  kind: 'prose';
  text: string;
}
export type InlineMark = 'strong' | 'emphasis' | 'code';
export interface InlineRun {
  text: string;
  marks?: InlineMark[];
  href?: string;
}
export interface RichTextBlock extends Block {
  kind: 'richtext';
  content: InlineRun[];
}
export interface ListItem {
  content: InlineRun[];
  children?: ListContent;
}
export interface ListContent {
  ordered: boolean;
  items: ListItem[];
}
export interface ListBlock extends Block, ListContent {
  kind: 'list';
}
export interface CodeBlock extends Block {
  kind: 'code';
  text: string;
  language?: string;
}
export interface ComparisonBlock extends Block {
  kind: 'comparison';
  subject: string;
  fields: { key: string; label: string; unit?: string }[];
  items: { name: string; attributes: Record<string, Cell> }[];
}
export interface InsightBlock extends Block {
  kind: 'insight';
  level: 'info' | 'success' | 'warning' | 'error';
  text: string;
}
export interface MetricsBlock extends Block {
  kind: 'metrics';
  items: {
    label: string;
    value: number;
    unit?: string;
    comparisonValue?: number;
    comparisonLabel?: string;
  }[];
}
export interface StepsBlock extends Block {
  kind: 'steps';
  title?: string;
  items: { title: string; description?: string }[];
}
export interface TimelineBlock extends Block {
  kind: 'timeline';
  title?: string;
  items: { time: string; title: string; description?: string }[];
}
export interface Section {
  id?: string;
  title: string;
  blocks?: Block[];
  sections?: Section[];
}
export interface Source {
  id: string;
  title: string;
  url?: string;
}
export interface Document {
  schemaVersion: '1.0';
  title: string;
  locale?: string;
  sources?: Source[];
  sections: Section[];
}
export interface Config {
  theme: string;
  layout: string;
  themes: string[];
  layouts: string[];
  overrides: Record<string, string>;
  plugins: string[];
  interactive: boolean;
}
export interface PresentationContext {
  locale: string;
  layout: LayoutName;
}
export interface RenderContext extends PresentationContext {
  headingLevel: number;
}
export interface BrowserEntry {
  entry: string;
  exportName: string;
  label?: string;
}
export interface SupportResult {
  supported: boolean;
  reason: string;
}
// Only the HTML helper creates fragments; plugin code is trusted build-time code.
export interface HtmlFragment {
  readonly value: string;
  readonly __safeHtml: true;
}
export interface Variant {
  id: string;
  supports(data: Block, context: PresentationContext): SupportResult;
  score(data: Block, context: PresentationContext): number;
  render(data: Block, context: RenderContext): HtmlFragment;
  assets?: StyleAsset[];
  browser?: BrowserEntry;
}
export interface StyleAsset {
  id: string;
  type: 'css';
  content: string;
  dependsOn?: string[];
}
export interface KindDefinition {
  kind: string;
  dataVersion: '1.0';
  schema: JsonSchema;
  variants: Variant[];
}
export interface Plugin {
  id: string;
  version: string;
  pluginApiVersion: '1.0';
  kinds?: KindDefinition[];
  extensions?: VariantExtension[];
  requires?: Record<string, string>;
}
export interface VariantExtension {
  targetKind: string;
  targetDataVersion: '1.0';
  variants: Variant[];
}
export interface Diagnostic {
  path: string;
  code: string;
  message: string;
}
export class SemloomError extends Error {
  constructor(
    public readonly diagnostics: Diagnostic[],
    public readonly exitCode: 1 | 2 = 2,
  ) {
    super(
      diagnostics.map((d) => `${d.path} [${d.code}] ${d.message}`).join('\n'),
    );
    this.name = 'SemloomError';
  }
}
export function fail(path: string, code: string, message: string): never {
  throw new SemloomError([{ path, code, message }]);
}
