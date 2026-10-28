import type { ResolvedDocument, ResolvedSection } from '../core/document.js';
import type { PresentationPlan } from '../core/planner.js';
import type { Registry } from '../core/registry.js';
import type { InteractivePlan } from './types.js';

export function planInteractive(
  document: ResolvedDocument,
  plan: PresentationPlan,
  registry: Registry,
): InteractivePlan {
  const result: InteractivePlan = { blocks: [], adapters: new Map() };
  const planned = new Map(plan.blocks.map((block) => [block.id, block]));
  function visit(sections: ResolvedSection[], headingLevel: number) {
    for (const section of sections) {
      for (const block of section.blocks) {
        const selection = planned.get(block.id)!;
        const candidates = selection.candidates
          .filter(
            (candidate) =>
              candidate.supported &&
              registry.variant(block.data.kind, candidate.id).browser,
          )
          .map((candidate) => candidate.id);
        if (candidates.length < 2) continue;
        for (const id of candidates)
          result.adapters.set(
            id,
            registry.variant(block.data.kind, id).browser!,
          );
        result.blocks.push({
          id: block.id,
          selected: selection.selected,
          candidates,
          data: { ...block.data, id: block.id },
          context: { ...plan.context, headingLevel: headingLevel + 1 },
        });
      }
      visit(section.sections, headingLevel + 1);
    }
  }
  visit(document.sections, 2);
  return result;
}
