import { renderTracked } from './browser-views.mjs';

const style = {
  id: 'fixture.interactive',
  type: 'css',
  content: '.fixture-view{white-space:pre-wrap;overflow-wrap:anywhere}',
};
const variant = (id, exportName) => ({
  id,
  supports: () => ({ supported: true, reason: 'fixture compatibility' }),
  score: () => 1,
  render: renderTracked,
  assets: [style],
  ...(exportName
    ? { browser: { entry: './browser-views.mjs', exportName, label: id } }
    : {}),
});
export default {
  id: 'fixture.lifecycle',
  version: '1.0',
  pluginApiVersion: '1.0',
  extensions: [
    {
      targetKind: 'comparison',
      targetDataVersion: '1.0',
      variants: [
        variant('fixture.tracked', 'trackedView'),
        variant('fixture.failed', 'failedView'),
        variant('fixture.dispose-error', 'brokenDisposeView'),
        variant('fixture.static'),
        {
          ...variant('fixture.unsupported', 'MUST_NOT_BE_BUNDLED'),
          browser: {
            entry: './must-not-exist.mjs',
            exportName: 'MUST_NOT_BE_BUNDLED',
          },
          supports: () => ({
            supported: false,
            reason: 'incompatible fixture',
          }),
        },
      ],
    },
  ],
};
