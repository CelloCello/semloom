import { Ajv } from 'ajv';
import { assetCatalog, resolveAssets } from './assets.js';
import {
  fail,
  type KindDefinition,
  type Plugin,
  type Variant,
  type StyleAsset,
} from './types.js';

const name = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/u;
const namespaced = /^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9_.-]+$/u;
const version = (value: unknown) =>
  typeof value === 'string' && /^[\w.+-]{1,80}$/u.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class Registry {
  private kinds = new Map<string, KindDefinition>();
  private plugins: Plugin[] = [];
  private frozen = false;
  private catalog = new Map<string, StyleAsset>();

  register(input: unknown): void {
    if (this.frozen) fail('/', 'REGISTRY_FROZEN', 'Registry is frozen.');
    validatePlugin(input);
    if (this.plugins.some((p) => p.id === input.id))
      fail('/', 'PLUGIN_CONFLICT', `Duplicate plugin ${input.id}.`);
    const candidate = [...this.plugins, copyPlugin(input)];
    const kinds = new Set<string>();
    const variants = new Set<string>();
    for (const plugin of candidate) {
      for (const kind of plugin.kinds ?? []) {
        if (kinds.has(kind.kind))
          fail('/', 'KIND_CONFLICT', `Duplicate kind ${kind.kind}.`);
        kinds.add(kind.kind);
      }
      for (const variant of contributions(plugin)) {
        if (variants.has(variant.id))
          fail('/', 'VARIANT_CONFLICT', `Duplicate variant ${variant.id}.`);
        variants.add(variant.id);
      }
    }
    this.plugins = candidate;
  }

  freeze(): void {
    if (this.frozen) return;
    const kinds = new Map<string, KindDefinition>();
    for (const plugin of this.plugins) {
      for (const [id, expected] of Object.entries(plugin.requires ?? {})) {
        const dependency = this.plugins.find((p) => p.id === id);
        if (!dependency)
          fail('/', 'PLUGIN_DEPENDENCY', `Missing plugin ${id}.`);
        if (dependency.version !== expected)
          fail(
            '/',
            'PLUGIN_DEPENDENCY_VERSION',
            `Plugin ${id} must have version ${expected}.`,
          );
      }
      for (const kind of plugin.kinds ?? [])
        kinds.set(kind.kind, copyKind(kind));
    }
    // Extensions resolve after all definitions, independent of plugin load order.
    for (const plugin of this.plugins) {
      for (const extension of plugin.extensions ?? []) {
        const target = kinds.get(extension.targetKind);
        if (!target)
          fail(
            '/',
            'EXTENSION_TARGET',
            `Missing kind ${extension.targetKind}.`,
          );
        if (target.dataVersion !== extension.targetDataVersion)
          fail(
            '/',
            'EXTENSION_VERSION',
            `Incompatible data version for ${extension.targetKind}.`,
          );
        target.variants.push(...extension.variants.map(copyVariant));
      }
    }
    const catalog = assetCatalog(
      this.plugins.flatMap((p) =>
        contributions(p).flatMap((v) => v.assets ?? []),
      ),
    );
    this.kinds = kinds;
    this.catalog = catalog;
    this.frozen = true;
  }
  definitions(): KindDefinition[] {
    this.freeze();
    return [...this.kinds.values()].map(copyKind);
  }
  kind(name: string): KindDefinition {
    this.freeze();
    const kind = this.kinds.get(name);
    if (!kind) fail('/', 'UNKNOWN_KIND', `Unsupported kind ${name}.`);
    return copyKind(kind);
  }
  variant(kind: string, id: string): Variant {
    const variant = this.kind(kind).variants.find((v) => v.id === id);
    if (!variant)
      fail('/', 'UNKNOWN_VARIANT', `Unknown variant ${id} for ${kind}.`);
    return variant;
  }
  assetsFor(ids: string[]): StyleAsset[] {
    this.freeze();
    const selected = new Set(ids);
    return resolveAssets(
      this.catalog,
      [...this.kinds.values()]
        .flatMap((k) => k.variants)
        .filter((v) => selected.has(v.id))
        .flatMap((v) => (v.assets ?? []).map((a) => a.id)),
    );
  }
  list(): unknown[] {
    this.freeze();
    return this.plugins.map((p) => ({
      id: p.id,
      version: p.version,
      pluginApiVersion: p.pluginApiVersion,
      kinds: (p.kinds ?? []).map((k) => ({
        kind: k.kind,
        dataVersion: k.dataVersion,
        variants: k.variants.map((v) => v.id),
        browserVariants: k.variants.filter((v) => v.browser).map((v) => v.id),
      })),
      extensions: (p.extensions ?? []).map((e) => ({
        targetKind: e.targetKind,
        targetDataVersion: e.targetDataVersion,
        variants: e.variants.map((v) => v.id),
        browserVariants: e.variants.filter((v) => v.browser).map((v) => v.id),
      })),
      requires: { ...p.requires },
    }));
  }
}

function contributions(plugin: Plugin): Variant[] {
  return [
    ...(plugin.kinds ?? []).flatMap((k) => k.variants),
    ...(plugin.extensions ?? []).flatMap((e) => e.variants),
  ];
}
function validateVariants(variants: unknown): asserts variants is Variant[] {
  if (
    !Array.isArray(variants) ||
    variants.length === 0 ||
    variants.length > 100
  )
    fail('/', 'VARIANT_MANIFEST', 'Expected 1–100 variants.');
  for (const variant of variants) {
    if (
      !object(variant) ||
      typeof variant.id !== 'string' ||
      !namespaced.test(variant.id) ||
      ['supports', 'score', 'render'].some(
        (key) => typeof variant[key] !== 'function',
      ) ||
      (variant.assets !== undefined && !Array.isArray(variant.assets)) ||
      Object.keys(variant).some(
        (key) =>
          !['id', 'supports', 'score', 'render', 'assets', 'browser'].includes(
            key,
          ),
      )
    )
      fail(
        '/',
        'VARIANT_MANIFEST',
        'Variant needs a namespaced ID, supports, score, render and optional CSS assets.',
      );
    if (variant.browser !== undefined) {
      const browser = variant.browser;
      if (
        !object(browser) ||
        Object.keys(browser).some(
          (key) => !['entry', 'exportName', 'label'].includes(key),
        ) ||
        typeof browser.entry !== 'string' ||
        !browser.entry.length ||
        !/^(?:\/|[A-Za-z]:[\\/]|\.\.?[\\/])/u.test(browser.entry) ||
        browser.entry.length > 4000 ||
        (browser.label !== undefined &&
          (typeof browser.label !== 'string' ||
            !browser.label.length ||
            browser.label.length > 200)) ||
        typeof browser.exportName !== 'string' ||
        browser.exportName.length > 200 ||
        !/^[A-Za-z_$][\w$]*$/u.test(browser.exportName)
      )
        fail(
          '/',
          'BROWSER_MANIFEST',
          'Browser adapter needs a local entry and an exportName identifier.',
        );
    }
  }
}
function validatePlugin(input: unknown): asserts input is Plugin {
  if (
    !object(input) ||
    typeof input.id !== 'string' ||
    !name.test(input.id) ||
    !version(input.version)
  )
    fail('/', 'PLUGIN_MANIFEST', 'Plugin needs a bounded ID and version.');
  if (input.pluginApiVersion !== '1.0')
    fail(
      '/',
      'PLUGIN_VERSION',
      'Unsupported plugin API version; expected 1.0.',
    );
  if (
    Object.keys(input).some(
      (key) =>
        ![
          'id',
          'version',
          'pluginApiVersion',
          'kinds',
          'extensions',
          'requires',
        ].includes(key),
    ) ||
    (input.kinds !== undefined && !Array.isArray(input.kinds)) ||
    (input.extensions !== undefined && !Array.isArray(input.extensions)) ||
    ((input.kinds as unknown[] | undefined)?.length ?? 0) +
      ((input.extensions as unknown[] | undefined)?.length ?? 0) ===
      0
  )
    fail(
      '/',
      'PLUGIN_MANIFEST',
      'Expected kind definitions and/or variant extensions.',
    );
  if (
    input.requires !== undefined &&
    (!object(input.requires) ||
      Object.entries(input.requires).some(
        ([id, value]) => !name.test(id) || !version(value),
      ))
  )
    fail(
      '/',
      'PLUGIN_DEPENDENCY',
      'Plugin dependencies use exact ID/version pairs.',
    );
  for (const kind of (input.kinds ?? []) as unknown[]) {
    if (
      !object(kind) ||
      Object.keys(kind).some(
        (key) => !['kind', 'dataVersion', 'schema', 'variants'].includes(key),
      ) ||
      typeof kind.kind !== 'string' ||
      (input.id === 'semloom.builtin'
        ? !name.test(kind.kind)
        : !namespaced.test(kind.kind)) ||
      !object(kind.schema) ||
      kind.schema.type !== 'object' ||
      !object(kind.schema.properties)
    )
      fail(
        '/',
        'KIND_MANIFEST',
        'Kinds need a namespaced name and an object content schema.',
      );
    if (kind.dataVersion !== '1.0')
      fail('/', 'KIND_VERSION', 'Unsupported kind data version; expected 1.0.');
    const properties = kind.schema.properties;
    if (
      ['id', 'kind', 'sourceIds'].some((key) => Object.hasOwn(properties, key))
    )
      fail(
        '/',
        'ENVELOPE_CONFLICT',
        'Kind schemas cannot redefine common fields.',
      );
    try {
      new Ajv({ strict: true }).compile(kind.schema);
    } catch {
      fail(
        '/',
        'PLUGIN_SCHEMA',
        `Invalid strict JSON Schema for ${kind.kind}.`,
      );
    }
    validateVariants(kind.variants);
  }
  for (const extension of (input.extensions ?? []) as unknown[]) {
    if (
      !object(extension) ||
      Object.keys(extension).some(
        (key) => !['targetKind', 'targetDataVersion', 'variants'].includes(key),
      ) ||
      typeof extension.targetKind !== 'string' ||
      !name.test(extension.targetKind)
    )
      fail(
        '/',
        'EXTENSION_MANIFEST',
        'Extension needs only a target kind/version and variants.',
      );
    if (typeof extension.targetDataVersion !== 'string')
      fail(
        '/',
        'EXTENSION_VERSION',
        'Extension needs an exact target data version.',
      );
    validateVariants(extension.variants);
  }
}
function copyVariant(variant: Variant): Variant {
  return {
    ...variant,
    ...(variant.assets ? { assets: structuredClone(variant.assets) } : {}),
    ...(variant.browser ? { browser: { ...variant.browser } } : {}),
  };
}
function copyKind(kind: KindDefinition): KindDefinition {
  return {
    ...kind,
    schema: structuredClone(kind.schema),
    variants: kind.variants.map(copyVariant),
  };
}
function copyPlugin(plugin: Plugin): Plugin {
  return {
    ...plugin,
    ...(plugin.kinds ? { kinds: plugin.kinds.map(copyKind) } : {}),
    ...(plugin.extensions
      ? {
          extensions: plugin.extensions.map((e) => ({
            ...e,
            variants: e.variants.map(copyVariant),
          })),
        }
      : {}),
    ...(plugin.requires ? { requires: { ...plugin.requires } } : {}),
  };
}
