import { readFileSync } from 'node:fs';
export const research = JSON.parse(
  readFileSync(new URL('../examples/comparison.json', import.meta.url), 'utf8'),
);
export function comparisonDocument(attributes = { value: 0 }) {
  return {
    schemaVersion: '1.0',
    title: '測試文件',
    sections: [
      {
        title: '中文章節',
        blocks: [
          {
            id: 'compare',
            kind: 'comparison',
            subject: '比較',
            fields: Object.keys(attributes).map((key) => ({ key, label: key })),
            items: [{ name: 'A', attributes }],
          },
        ],
      },
    ],
  };
}
