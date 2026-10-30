import type { Registry } from './registry.js';
import type { ResolvedDocument } from './document.js';
import {
  fail,
  layoutNames,
  type Config,
  type PresentationContext,
  type LayoutName,
} from './types.js';

export interface PlannedBlock {
  id: string;
  explicit: boolean;
  kind: string;
  selected: string;
  origin: 'auto' | 'override';
  candidates: {
    id: string;
    supported: boolean;
    reason: string;
    score: number | null;
  }[];
  tieBreak: 'score-descending-then-variant-id';
}
export interface PresentationPlan {
  context: PresentationContext;
  blocks: PlannedBlock[];
}
export function planDocument(
  document: ResolvedDocument,
  config: Config,
  registry: Registry,
  baseLayout?: LayoutName,
): PresentationPlan {
  const layout = baseLayout ?? config.layout;
  if (!(layoutNames as readonly string[]).includes(layout))
    fail(
      '/layout',
      'LAYOUT_RESOLUTION_REQUIRED',
      'Pass the resolved base Layout when planning an external Layout.',
    );
  for (const id of Object.keys(config.overrides)) {
    const block = document.blocks.find((b) => b.id === id);
    if (!block?.explicit)
      fail(
        `/overrides/${id}`,
        'OVERRIDE_TARGET',
        'Override must refer to an explicit Block ID.',
      );
  }
  const context: PresentationContext = {
    locale: document.data.locale ?? 'zh-TW',
    layout: layout as LayoutName,
  };
  return {
    context,
    blocks: document.blocks.map((block) => {
      const candidates = registry
        .kind(block.data.kind)
        .variants.map((variant) => {
          const support = variant.supports(block.data, context);
          const score = support.supported
            ? variant.score(block.data, context)
            : null;
          if (score !== null && !Number.isFinite(score))
            fail(block.path, 'INVALID_SCORE', 'Variant score must be finite.');
          return { id: variant.id, ...support, score };
        })
        .sort(
          (a, b) =>
            (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );
      const override = Object.hasOwn(config.overrides, block.id)
        ? config.overrides[block.id]
        : undefined;
      const chosen =
        override === undefined
          ? candidates.find((c) => c.supported)
          : candidates.find((c) => c.id === override);
      if (!chosen || !chosen.supported)
        fail(
          block.path,
          override === undefined ? 'NO_VARIANT' : 'INVALID_OVERRIDE',
          'No compatible variant for this selection.',
        );
      return {
        id: block.id,
        explicit: block.explicit,
        kind: block.data.kind,
        selected: chosen.id,
        origin: override === undefined ? 'auto' : 'override',
        candidates,
        tieBreak: 'score-descending-then-variant-id',
      };
    }),
  };
}
