// Fixed-domain counterexamples on both sides of the former EPSILON guard.
export const fixedDomainCases = [
  [-7.330056105833499e-308, -7.330056105833656e-308, -7.330056105833812e-308],
  [-3.574903517705389e-307, -3.574903517705505e-307, -3.5749035177056205e-307],
  [1897.6200639968738, 1897.6200639968897, 1897.6200639969059],
  [-3.019553782558069e-100, -3.019553782558138e-100, -3.0195537825582075e-100],
  [5.0832593551138415e300, 5.083259355114959e300, 5.0832593551160773e300],
  [-6.99404900639785e-309, -6.994049006397876e-309, -6.994049006397896e-309],
  [-7.96738774748519e-308, -7.967387747485319e-308, -7.967387747485447e-308],
  [-3.7241599861765287e300, -3.724159986176567e300, -3.7241599861766054e300],
  [-3.5552413663826883, -3.5552413663828073, -3.5552413663829276],
];

export function chartBlock(overrides = {}) {
  return {
    kind: 'chart',
    title: '服務處理量',
    description: '示例資料，非實際績效。',
    chartType: 'bar',
    unit: '件',
    categories: [
      { key: '__proto__', label: '文件匯入' },
      { key: 'hasOwnProperty', label: '文件匯入' },
      { key: 'c', label: '資料驗證' },
    ],
    series: [
      { key: '__proto__', label: '本期', values: [128, 0, null] },
      { key: 'hasOwnProperty', label: '本期', values: [104, -12, 112] },
    ],
    ...overrides,
  };
}
export const diagramSources = {
  flowchart:
    'flowchart LR\n A[輸入] --> B{驗證}\n B -->|成功| C[輸出]\n B -->|失敗| D[診斷]',
  sequence:
    'sequenceDiagram\n participant A as 作者\n participant B as 編譯器\n A->>B: 提交資料\n B-->>A: 完整報告',
  class:
    'classDiagram\n class Report {\n +String title\n +compile()\n }\n Report --> Section : contains',
  er: 'erDiagram\n REPORT ||--o{ SECTION : contains\n SECTION {\n string title\n }',
  state:
    'stateDiagram-v2\n [*] --> Draft\n state Draft {\n Editing --> Validating\n }\n Draft --> Ready\n Ready --> [*]',
};
export function diagramBlock(
  source = diagramSources.flowchart,
  overrides = {},
) {
  return {
    kind: 'diagram',
    title: '報告產生流程',
    description: '資料通過驗證後輸出；失敗時保留原檔。',
    language: 'mermaid',
    source,
    ...overrides,
  };
}
export function visualDocument(
  blocks = [
    chartBlock(),
    ...Object.values(diagramSources).map((s) => diagramBlock(s)),
  ],
) {
  return {
    schemaVersion: '1.0',
    title: '圖表與技術圖解',
    sections: [{ title: '資料與流程', blocks }],
  };
}
