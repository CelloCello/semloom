import { readFileSync } from 'node:fs';

// Fixed initial/edit task shared by unit, CLI and browser checks.
export function technicalGuide(edited = false) {
  const document = JSON.parse(
    readFileSync(
      new URL('../../examples/technical-guide.json', import.meta.url),
      'utf8',
    ),
  );
  if (edited) {
    document.sections[0].blocks[1].items[0].children.items[1].content[0].text =
      '保留輸入 JSON 與 presentation config，方便後續重建。';
    document.sections[1].blocks[0].text =
      document.sections[1].blocks[0].text.replace(
        '--explain',
        '--explain --theme midnight',
      );
  }
  return document;
}
