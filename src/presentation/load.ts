import { readFile } from 'node:fs/promises';
import { dirname, resolve, isAbsolute, extname } from 'node:path';
import {
  PresentationCatalog,
  themeDefinitionSchema,
  layoutDefinitionSchema,
} from '../core/presentation.js';
import { checkSchema } from '../core/schema.js';
import { fail, SemloomError, type Config } from '../core/types.js';

export async function loadPresentation(
  config: Pick<Config, 'themes' | 'layouts'>,
  baseDirectory = process.cwd(),
): Promise<PresentationCatalog> {
  const definitions: Record<'themes' | 'layouts', unknown[]> = {
    themes: [],
    layouts: [],
  };
  const files: string[] = [];
  for (const category of ['themes', 'layouts'] as const) {
    const paths = config[category];
    if (!Array.isArray(paths) || paths.length > 50)
      fail(
        `/${category}`,
        'PRESENTATION_PATH',
        'Expected at most 50 manifest paths.',
      );
    for (const [index, path] of paths.entries()) {
      const location = `/${category}/${index}`;
      const file = localPath(path, baseDirectory, location);
      if (extname(file) !== '.json')
        fail(location, 'PRESENTATION_PATH', 'Expected a local .json manifest.');
      let input: unknown;
      try {
        input = JSON.parse(await readBounded(file, 1000000));
      } catch {
        fail(
          location,
          'PRESENTATION_READ',
          `Cannot read bounded JSON manifest ${file}.`,
        );
      }
      const schema =
        category === 'themes' ? themeDefinitionSchema : layoutDefinitionSchema;
      const { css: _css, ...properties } = schema.properties;
      void _css;
      try {
        checkSchema<Record<string, unknown> & { cssFile?: string }>(
          {
            ...schema,
            properties: {
              ...properties,
              cssFile: { type: 'string', minLength: 1, maxLength: 4000 },
            },
          },
          input,
        );
      } catch (error) {
        if (error instanceof SemloomError)
          throw new SemloomError(
            error.diagnostics.map((d) => ({
              ...d,
              path: location + (d.path === '/' ? '' : d.path),
            })),
          );
        throw error;
      }
      files.push(file);
      const { cssFile, ...definition } = input;
      if (cssFile !== undefined) {
        const cssPath = localPath(
          cssFile,
          dirname(file),
          `${location}/cssFile`,
        );
        try {
          definition.css = await readBounded(cssPath, 200000);
        } catch {
          fail(
            `${location}/cssFile`,
            'PRESENTATION_READ',
            `Cannot read bounded CSS file ${cssPath}.`,
          );
        }
        files.push(cssPath);
      }
      definitions[category].push(definition);
    }
  }
  return new PresentationCatalog(definitions, files);
}
function localPath(path: string, base: string, location: string): string {
  if (
    typeof path !== 'string' ||
    (!isAbsolute(path) && !path.startsWith('./') && !path.startsWith('../')) ||
    path.includes('\u0000')
  )
    fail(location, 'PRESENTATION_PATH', 'Expected an explicit local path.');
  return resolve(base, path);
}
async function readBounded(file: string, limit: number): Promise<string> {
  const bytes = await readFile(file);
  if (bytes.byteLength > limit) throw new Error('File exceeds size limit.');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
