import { readFileSync } from 'node:fs';

const original = JSON.parse(
  readFileSync(
    new URL('../../examples/reading-report.json', import.meta.url),
    'utf8',
  ),
);
export function localizationDocument(locale = 'zh-TW') {
  const input = structuredClone(original);
  input.locale = locale;
  input.title = 'Original 原文 <&> report';
  input.sections[0].blocks[0].text =
    'Original 原文 **literal** 2026-10-30 1,234.50';
  const metrics = input.sections[0].blocks[1];
  delete metrics.items[0].comparisonLabel;
  metrics.items[1].comparisonLabel = '作者 label';
  metrics.items[1].comparisonValue = -1;
  const comparison = input.sections[1].blocks[0];
  comparison.fields = [
    'zero',
    'false',
    'empty',
    'null',
    'missing',
    'constructor',
    'original',
  ].map((key) => ({
    key,
    label: `原文 ${key}`,
    unit: key === 'zero' ? 'ms' : '',
  }));
  for (const item of comparison.items)
    item.attributes = {
      zero: 0,
      false: false,
      empty: '',
      null: null,
      original: '未提供',
    };
  const code = input.sections[2].blocks[2];
  code.language = 'js 原文';
  code.text = '\tconst 原文 = "<>&";\r\n\r\n// 1,234.50\n';
  input.sections[2].blocks[3].items[0].time = '2026/10/30 09:00 +08:00（原文）';
  return input;
}
