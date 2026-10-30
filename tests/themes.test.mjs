import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compile, themeNames, layoutNames } from '../dist/index.js';
import { resolveTheme, themeCss } from '../dist/html/themes/index.js';
import { expectedMindmapPalettes } from './fixtures/mindmap-palettes.mjs';
import { research } from './helpers.mjs';

test('all themes and layouts preserve data, selections and theme-independent navigation markup', () => {
  for (const layout of layoutNames) {
    const results = themeNames.map((theme) =>
      compile(research, { theme, layout }),
    );
    for (const [index, result] of results.entries()) {
      assert.deepEqual(result.document.data, research);
      assert.deepEqual(result.plan, results[0].plan);
      assert.equal(
        result.html,
        compile(research, {
          theme: themeNames[index],
          layout,
        }).html,
      );
    }
    const body = (output) => output.slice(output.indexOf('<body>'));
    for (const result of results.slice(1)) {
      assert.equal(body(results[0].html), body(result.html));
      assert.notEqual(results[0].html, result.html);
    }
  }
  const minimal = resolveTheme('minimal');
  const editorial = resolveTheme('editorial');
  assert.equal(editorial.radius, minimal.radius);
  assert.equal(editorial.measure, minimal.measure);
  assert.notEqual(editorial['font-body'], minimal['font-body']);
  editorial.ink = 'mutated';
  assert.notEqual(resolveTheme('editorial').ink, 'mutated');
});

function luminance(hex) {
  const expanded =
    hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
  const rgb = [0, 2, 4].map((start) => {
    const value = parseInt(expanded.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('shared TOC exposes sources only when present and keeps one navigation region', () => {
  const input = {
    schemaVersion: '1.0',
    title: '目錄範例',
    sections: [
      {
        id: 'topic',
        title: '正文',
        blocks: [{ kind: 'prose', text: '完整內容' }],
      },
    ],
  };
  for (const sources of [
    undefined,
    [],
    [{ id: 'reference', title: '參考資料' }],
  ]) {
    const html = compile(
      { ...input, ...(sources ? { sources } : {}) },
      { layout: 'sidebar' },
    ).html;
    assert.equal((html.match(/<nav\b/g) ?? []).length, 1);
    assert.equal(
      (html.match(/ data-toc-source>/g) ?? []).length,
      sources?.length ? 1 : 0,
    );
    const title = sources?.length ? '目錄與資料來源' : '目錄';
    assert.ok(html.includes(`hidden>${title}</button>`));
    assert.ok(html.includes(`<h2>${title}</h2>`));
    if (sources?.length)
      assert.match(html, /href="#semloom-sources" data-toc-source/);
  }
});

// OKLab distance catches near-identical hues even when both contrast with paper.
function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const v = parseInt(hex.slice(start, start + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

test('theme text, links, focus and selection stay legible on their surfaces', () => {
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  for (const name of themeNames) {
    const tokens = resolveTheme(name);
    for (const background of [
      'paper',
      'surface',
      'table-head',
      'table-hover',
    ]) {
      for (const foreground of ['ink', 'muted', 'accent']) {
        assert.ok(
          contrast(
            luminance(tokens[foreground]),
            luminance(tokens[background]),
          ) >= 4.5,
          `${name}: ${foreground} on ${background} must remain readable.`,
        );
      }
    }
    assert.ok(
      contrast(luminance(tokens.ink), luminance(tokens.selection)) >= 4.5,
      name,
    );
  }
});

test('each built-in Theme emits six distinct visible mindmap colors; external Themes inherit by color scheme', () => {
  const palettes = [];
  for (const name of themeNames) {
    const css = themeCss(name),
      tokens = resolveTheme(name);
    const colors = Array.from(
      { length: 6 },
      (_, i) =>
        css.match(
          new RegExp(`--semloom-mindmap-branch-${i + 1}:(#[a-f0-9]{6})`),
        )[1],
    );
    assert.deepEqual(colors, expectedMindmapPalettes[name]);
    assert.equal(new Set(colors).size, 6, name);
    for (let i = 0; i < colors.length; i++)
      for (let j = i + 1; j < colors.length; j++) {
        const a = oklab(colors[i]),
          b = oklab(colors[j]);
        const distance = Math.hypot(...a.map((v, k) => v - b[k]));
        assert.ok(
          distance >= 0.08,
          `${name}: ${colors[i]} / ${colors[j]} separation ${distance}`,
        );
      }
    for (const color of colors)
      for (const key of ['paper', 'surface']) {
        const a = luminance(color),
          b = luminance(tokens[key]);
        assert.ok(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3,
          `${name}: branch ${color} on ${key}`,
        );
      }
    palettes.push(colors.join(','));
  }
  assert.equal(new Set(palettes).size, themeNames.length);
  const external = themeCss({
    id: 'example.inherit',
    themeApiVersion: '1.0',
    tokens: { accent: '#123456' },
  });
  for (const [i, color] of expectedMindmapPalettes.minimal.entries())
    assert.ok(external.includes(`--semloom-mindmap-branch-${i + 1}:${color}`));
  const dark = themeCss({
    id: 'example.dark',
    themeApiVersion: '1.0',
    tokens: { 'color-scheme': 'dark' },
  });
  for (const [i, color] of expectedMindmapPalettes.midnight.entries())
    assert.ok(dark.includes(`--semloom-mindmap-branch-${i + 1}:${color}`));
  assert.equal(
    Object.keys(resolveTheme('minimal')).some((key) => key.includes('mindmap')),
    false,
    'component variables do not expand public tokens',
  );
});

test('CSP authorizes only the exact static navigation script, independent of document payloads', () => {
  const input = structuredClone(research);
  input.title = '</script><script>globalThis.injected=true</script>';
  const output = compile(input).html;
  const scripts = [
    ...output.matchAll(/<script data-semloom-navigation>([\s\S]*?)<\/script>/g),
  ];
  assert.equal(scripts.length, 1);
  const script = scripts[0][1];
  const hash = createHash('sha256').update(script).digest('base64');
  assert.ok(output.includes(`script-src 'sha256-${hash}'`));
  assert.ok(!script.includes('globalThis.injected'));
  assert.ok(!output.includes("script-src 'unsafe-inline'"));
  const baseline = compile(research).html.match(
    /<script data-semloom-navigation>([\s\S]*?)<\/script>/,
  )[1];
  assert.equal(script, baseline);
});
