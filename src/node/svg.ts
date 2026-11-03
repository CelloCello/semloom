import { createHash } from 'node:crypto';
import { fragment } from '../html/html.js';
import type { HtmlFragment } from '../core/types.js';

export function svgIdentity(blockId: string, role: string): string {
  return `semloom-svg-${createHash('sha256').update(blockId).digest('hex').slice(0, 24)}-${role}`;
}
const elements = new Set(
  'svg g path rect circle ellipse polygon polyline line text tspan defs clipPath mask linearGradient radialGradient stop marker title desc'.split(
    ' ',
  ),
);
const attributes = new Set(
  'xmlns xmlns:xlink xml:space version baseProfile width height viewBox id class x y x1 x2 y1 y2 cx cy r rx ry dx dy d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-miterlimit opacity style font-size font-family font-weight font-style text-anchor dominant-baseline alignment-baseline textLength lengthAdjust clip-path clip-rule mask href xlink:href role tabindex focusable pointer-events overflow marker-start marker-mid marker-end markerWidth markerHeight markerUnits refX refY orient preserveAspectRatio gradientUnits gradientTransform offset stop-color stop-opacity'.split(
    ' ',
  ),
);
const styles = new Set(
  'font font-size font-family font-weight font-style text-decoration letter-spacing word-spacing text-transform direction color fill stroke stroke-width opacity rx ry text-anchor dominant-baseline white-space'.split(
    ' ',
  ),
);

// This accepts only the engines' controlled vector vocabulary. It never upgrades
// arbitrary semantic JSON to HTML, and never performs replacements in label text.
export function svgFragment(
  source: string,
  prefix: string,
  colors: ReadonlyMap<string, string> = new Map(),
): HtmlFragment {
  if (source.length > 2_000_000) throw new Error('SVG output limit.');
  // ECharts' SSR hover rules are engine-owned CSS. Static output has no hover
  // behavior; remove this whole known block instead of admitting a CSS language.
  const svg = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gu, '');
  const ids = new Map<string, string>();
  for (const tag of svg.matchAll(/<[^>]*>/gu))
    for (const match of tag[0].matchAll(/\sid="([^"]*)"/gu)) {
      if (ids.has(match[1]!)) throw new Error('Duplicate engine SVG ID.');
      ids.set(match[1]!, `${prefix}-${ids.size}`);
    }
  let root = false;
  const classes = new Map<string, string>();
  const stack: string[] = [];
  const result = svg.replace(/<[^>]*>/gu, (tag) => {
    const parsed = /^<(\/?)([A-Za-z][\w:.-]*)([\s\S]*?)(\/?)>$/u.exec(tag);
    if (!parsed || !elements.has(parsed[2]!))
      throw new Error('Unsupported engine SVG element.');
    const [, closing, name, body, selfClosing] = parsed;
    if (closing) {
      if (stack.pop() !== name || body!.trim())
        throw new Error('Invalid SVG nesting.');
      return `</${name}>`;
    }
    if (!root) {
      if (name !== 'svg') throw new Error('Expected SVG root.');
      root = true;
    }
    if (!selfClosing) stack.push(name!);
    let remainder = body!;
    const attrs: string[] = [];
    for (const match of body!.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/gu)) {
      const key = match[1]!;
      let value = match[2]!;
      remainder = remainder.replace(match[0], '');
      if (
        !attributes.has(key) &&
        !/^(?:aria-[a-z-]+|data-[\w-]+|ecmeta_[\w_]+)$/u.test(key)
      )
        throw new Error(`Unsupported SVG attribute ${key}.`);
      if (key === 'id') value = ids.get(value)!;
      if (key === 'class')
        value = value.replace(/\bzr\d+-cls-\d+\b/gu, (name) => {
          if (!classes.has(name))
            classes.set(name, `${prefix}-cls-${classes.size}`);
          return classes.get(name)!;
        });
      if (key === 'href' || key === 'xlink:href') {
        if (!value.startsWith('#') || !ids.has(value.slice(1)))
          throw new Error('External or missing SVG reference.');
        value = `#${ids.get(value.slice(1))}`;
      }
      if (key === 'aria-labelledby' || key === 'aria-describedby')
        value = value
          .split(/\s+/u)
          .map((id) => {
            if (!ids.has(id)) throw new Error('Missing ARIA reference.');
            return ids.get(id);
          })
          .join(' ');
      value = value.replace(/url\(#([^)]*)\)/gu, (_all, id: string) => {
        if (!ids.has(id)) throw new Error('Missing SVG reference.');
        return `url(#${ids.get(id)})`;
      });
      if (
        key !== 'xmlns' &&
        key !== 'xmlns:xlink' &&
        /(?:https?:|data:|javascript:|\/\/|@import|expression\s*\(|url\((?!#))/iu.test(
          value,
        )
      )
        throw new Error('Unsafe SVG attribute.');
      if (key === 'style') {
        value = value
          .split(';')
          .filter(Boolean)
          .map((declaration) => {
            const index = declaration.indexOf(':');
            const property = declaration.slice(0, index).trim();
            let setting = declaration.slice(index + 1).trim();
            if (!styles.has(property) && !/^--_[a-z]+$/u.test(property))
              throw new Error(`Unsupported SVG style ${property}.`);
            if (/[<>\\]/u.test(setting) || /&(?:#|[a-z])/iu.test(setting))
              throw new Error('Unsafe SVG style.');
            setting = colors.get(setting) ?? setting;
            if (property === 'font-family') setting = 'var(--font-body)';
            return `${property}:${setting}`;
          })
          .join(';');
      } else if (key === 'fill' || key === 'stroke' || key === 'color')
        value = colors.get(value) ?? value;
      if (
        /^(?:d|transform|points|viewBox|width|height|x|y|cx|cy)$/u.test(key) &&
        /(?:NaN|Infinity)/u.test(value)
      )
        throw new Error('Non-finite SVG geometry.');
      attrs.push(`${key}="${value}"`);
    }
    if (remainder.trim()) throw new Error('Unparsed SVG attributes.');
    return `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClosing ? '/' : ''}>`;
  });
  if (!root || stack.length || !result.trim().endsWith('</svg>'))
    throw new Error('Invalid SVG fragment.');
  return fragment(result);
}
