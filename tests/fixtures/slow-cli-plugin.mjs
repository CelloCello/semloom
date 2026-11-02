// A real CLI stays alive until cancellation. The finite fallback also lets a
// broken cancellation implementation exit without leaving a test daemon.
await new Promise((resolve) => setTimeout(resolve, 5000));

export default {
  id: 'fixture.cancellation',
  version: '1',
  pluginApiVersion: '1.0',
  extensions: [
    {
      targetKind: 'prose',
      targetDataVersion: '1.0',
      variants: [
        {
          id: 'fixture.cancellation.prose',
          supports: () => ({
            supported: true,
            reason: 'Cancellation fixture.',
          }),
          score: () => 0,
          render: () => null,
        },
      ],
    },
  ],
};
