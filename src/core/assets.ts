import { createHash } from 'node:crypto';
import { fail, type StyleAsset } from './types.js';

export function assetCatalog(assets: StyleAsset[]): Map<string, StyleAsset> {
  const catalog = new Map<string, StyleAsset>();
  for (const asset of assets) {
    if (
      !asset ||
      Object.keys(asset).some(
        (key) => !['id', 'type', 'content', 'dependsOn'].includes(key),
      ) ||
      typeof asset.id !== 'string' ||
      !/^[\w.-]{1,200}$/u.test(asset.id) ||
      asset.type !== 'css' ||
      typeof asset.content !== 'string' ||
      asset.content.length > 200000 ||
      (asset.dependsOn !== undefined &&
        (!Array.isArray(asset.dependsOn) ||
          asset.dependsOn.some((id) => typeof id !== 'string')))
    )
      fail(
        '/',
        'ASSET_MANIFEST',
        'Expected a named, bounded CSS asset with optional dependency IDs.',
      );
    if (
      /<\/style|@import\b|\b(?:url|src|image|(?:-webkit-)?image-set)\s*\(|(?:https?|file|data|javascript):|\\|\/\*/iu.test(
        asset.content,
      )
    )
      fail(
        '/',
        'ASSET_CONTENT',
        'CSS assets cannot contain style terminators, imports, URLs, escapes or comments.',
      );
    const existing = catalog.get(asset.id);
    if (
      existing &&
      (existing.content !== asset.content ||
        JSON.stringify(existing.dependsOn ?? []) !==
          JSON.stringify(asset.dependsOn ?? []))
    )
      fail('/', 'ASSET_CONFLICT', `Conflicting CSS asset ${asset.id}.`);
    catalog.set(asset.id, structuredClone(asset));
  }
  resolveAssets(catalog, [...catalog.keys()]);
  return catalog;
}
export function resolveAssets(
  catalog: Map<string, StyleAsset>,
  ids: string[],
): StyleAsset[] {
  const done = new Set<string>();
  const visiting = new Set<string>();
  const reachable: StyleAsset[] = [];
  function visit(id: string) {
    if (done.has(id)) return;
    if (visiting.has(id))
      fail('/', 'ASSET_CYCLE', `CSS dependency cycle at ${id}.`);
    const asset = catalog.get(id);
    if (!asset) fail('/', 'ASSET_DEPENDENCY', `Missing CSS asset ${id}.`);
    visiting.add(id);
    for (const dependency of [...(asset.dependsOn ?? [])].sort())
      visit(dependency);
    visiting.delete(id);
    done.add(id);
    reachable.push(asset);
  }
  for (const id of [...ids].sort()) visit(id);
  // Merge dependencies of identical content before ordering the emitted CSS.
  const hash = (asset: StyleAsset) =>
    createHash('sha256').update(asset.content).digest('hex');
  const nodes = new Map<
    string,
    { asset: StyleAsset; dependencies: Set<string> }
  >();
  for (const asset of reachable) {
    const key = hash(asset);
    const node = nodes.get(key) ?? { asset, dependencies: new Set<string>() };
    if (asset.id < node.asset.id) node.asset = asset;
    for (const id of asset.dependsOn ?? []) {
      const dependency = hash(catalog.get(id)!);
      if (dependency !== key) node.dependencies.add(dependency);
    }
    nodes.set(key, node);
  }
  const output: StyleAsset[] = [];
  const emitted = new Set<string>();
  const active = new Set<string>();
  function emit(key: string) {
    if (emitted.has(key)) return;
    if (active.has(key))
      fail(
        '/',
        'ASSET_CYCLE',
        'Content deduplication would produce contradictory CSS ordering.',
      );
    active.add(key);
    const node = nodes.get(key)!;
    for (const dependency of [...node.dependencies].sort()) emit(dependency);
    active.delete(key);
    emitted.add(key);
    output.push(structuredClone(node.asset));
  }
  for (const key of [...nodes.keys()].sort((a, b) =>
    nodes.get(a)!.asset.id < nodes.get(b)!.asset.id
      ? -1
      : nodes.get(a)!.asset.id > nodes.get(b)!.asset.id
        ? 1
        : 0,
  ))
    emit(key);
  return output;
}
