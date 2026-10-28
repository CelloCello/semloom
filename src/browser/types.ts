import type { Block, BrowserEntry, RenderContext } from '../core/types.js';

export interface BrowserContext extends RenderContext {
  signal: AbortSignal;
  onDispose(cleanup: () => void): void;
}
export interface BrowserView {
  element: HTMLElement;
  dispose(): void;
}
export type BrowserAdapter = (
  data: Block,
  context: BrowserContext,
) => BrowserView;

export interface InteractiveBlock {
  id: string;
  selected: string;
  candidates: string[];
  data: Block;
  context: RenderContext;
}
export interface InteractivePlan {
  blocks: InteractiveBlock[];
  adapters: Map<string, BrowserEntry>;
}
