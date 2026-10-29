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
