import { fail, SemloomError } from './types.js';

export function safeUrl(url: string): void {
  if (
    url.startsWith('#') &&
    url.length > 1 &&
    !/[\s\u0000-\u001f\u007f]/u.test(url)
  )
    return;
  if (url !== url.trim() || /[\s\u0000-\u001f\u007f]/u.test(url))
    fail(
      '/',
      'UNSAFE_URL',
      'URL must not contain whitespace or control characters.',
    );
  try {
    const parsed = new URL(url);
    if (
      ['https:', 'http:'].includes(parsed.protocol) &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
    )
      return;
  } catch {
    /* handled below */
  }
  fail(
    '/',
    'UNSAFE_URL',
    'Expected an absolute http(s) URL or a document anchor.',
  );
}

export function validateUrlReference(
  url: string,
  path: string,
  anchors: ReadonlySet<string>,
): void {
  try {
    safeUrl(url);
  } catch (error) {
    if (error instanceof SemloomError)
      throw new SemloomError(
        error.diagnostics.map((diagnostic) => ({ ...diagnostic, path })),
      );
    throw error;
  }
  if (!url.startsWith('#')) return;
  let target: string;
  try {
    target = decodeURIComponent(url.slice(1));
  } catch {
    fail(path, 'INVALID_ANCHOR', 'Invalid percent encoding.');
  }
  if (!anchors.has(target))
    fail(path, 'INVALID_ANCHOR', 'Anchor does not exist in this document.');
}
