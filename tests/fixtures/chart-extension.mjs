import { fileURLToPath } from 'node:url';
import { html } from '../../dist/index.js';
export default {
  id: 'test.chart',
  version: '1',
  pluginApiVersion: '1.0',
  extensions: [
    {
      targetKind: 'chart',
      targetDataVersion: '1.0',
      variants: ['one', 'two', 'fail'].map((name) => ({
        id: `test.chart.${name}`,
        supports: () => ({ supported: true, reason: 'Test chart View.' }),
        score: () => -1,
        render: () => html`<p>Extension chart</p>`,
        browser: {
          entry: fileURLToPath(
            new URL('./chart-extension-browser.mjs', import.meta.url),
          ),
          exportName: name,
          label: name,
        },
      })),
    },
  ],
};
