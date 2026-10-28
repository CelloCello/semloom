import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export function loadScenarios() {
  const cases = JSON.parse(
    readFileSync(new URL('benchmarks/scenarios/cases.json', root), 'utf8'),
  );
  return cases.map((scenario) => {
    const input = JSON.parse(
      readFileSync(fileURLToPath(new URL(scenario.input, root)), 'utf8'),
    );
    const edited = structuredClone(input);
    edited.title = scenario.editedTitle;
    const prose = edited.sections[0].blocks.find(
      (block) => block.kind === 'prose',
    );
    if (!prose)
      throw new Error(`Scenario ${scenario.id} needs introductory prose.`);
    prose.text += '\n' + scenario.appendText;
    return { ...scenario, initial: input, edited };
  });
}
