import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, createRegistry, html } from '../dist/index.js';
import { reportMessages, reportVariant } from '../dist/core/report-messages.js';
import { localizationDocument } from './fixtures/localization.mjs';

test('report locale resolution is deterministic, case-insensitive and preserves the legacy default', () => {
  for (const locale of [
    undefined,
    'zh',
    'zh-TW',
    'zh-Hant',
    'zh-Hans',
    'zh-CN',
    'fr-FR',
    'ja-JP',
    'enochian',
  ])
    assert.equal(reportMessages(locale).locale, 'zh-TW', locale);
  for (const locale of ['en', 'en-US', 'en-GB', 'EN-us'])
    assert.equal(reportMessages(locale).locale, 'en', locale);
  const explicit = localizationDocument();
  const implicit = structuredClone(explicit);
  delete implicit.locale;
  assert.equal(compile(explicit).html, compile(implicit).html);
  assert.ok(Object.isFrozen(reportMessages('en')));
  for (const locale of ['', 'en_US', 'en--US', '<script>'])
    assert.throws(() => compile(localizationDocument(locale)), /SCHEMA_/u);
});

test('localized UI preserves input, original locale, IDs, source order and Auto/Override decisions', () => {
  const registry = createRegistry();
  const options = {
    layout: 'sidebar',
    interactive: true,
    overrides: {
      'changes-comparison': 'comparison.responsive',
      'project-map': 'hierarchy.mindmap',
    },
  };
  const baseline = compile(localizationDocument(), options, registry);
  for (const locale of ['zh-TW', 'zh-Hans', 'en', 'en-US', 'EN-gb', 'fr-FR']) {
    const input = localizationDocument(locale),
      original = structuredClone(input);
    const output = compile(input, options, registry);
    assert.deepEqual(input, original);
    assert.deepEqual(output.document.data, original);
    assert.equal(output.plan.context.locale, locale);
    assert.deepEqual(output.plan.blocks, baseline.plan.blocks);
    assert.ok(output.html.includes(`lang="${locale}"`));
    const english = locale.toLowerCase().split('-')[0] === 'en';
    assert.ok(
      output.html.includes(`data-ui-locale="${english ? 'en' : 'zh-TW'}"`),
    );
    assert.match(output.html, /Original 原文 &lt;&amp;&gt; report/);
    assert.match(output.html, /作者 label/);
    assert.match(output.html, english ? />Not provided</ : />未提供</);
    assert.match(
      output.html,
      english ? />Contents and sources</u : />目錄與資料來源</u,
    );
    for (const variant of [
      'comparison.cards',
      'comparison.table',
      'comparison.responsive',
    ]) {
      const fragment = registry
        .variant('comparison', variant)
        .render(input.sections[1].blocks[0], {
          locale,
          layout: 'sidebar',
          headingLevel: 3,
        }).value;
      assert.equal(
        (fragment.match(/Not provided/g) ?? []).length,
        english ? (variant === 'comparison.responsive' ? 12 : 6) : 0,
      );
      assert.ok(fragment.includes('>0<'));
      assert.ok(fragment.includes('>false<'));
      assert.ok(fragment.includes('>未提供<'), 'user text is never translated');
    }
    const auto = compile(input, { layout: 'sidebar' }, registry);
    assert.deepEqual(
      auto.plan.blocks,
      compile(localizationDocument(), { layout: 'sidebar' }, registry).plan
        .blocks,
    );
  }
});

test('Plugin labels and comparison-label overrides stay authored text', () => {
  const label = 'Custom 原文 <label>';
  assert.deepEqual(reportVariant('comparison.custom', 'en-US', label), {
    label,
    locale: 'en-US',
  });
  assert.equal(
    reportVariant('comparison.cards', 'en-US', label).label,
    'Cards',
  );
  // Locale remains available to Plugins without changing their context contract.
  let context;
  const registry = createRegistry([
    {
      id: 'fixture.locale',
      version: '1.0',
      pluginApiVersion: '1.0',
      extensions: [
        {
          targetKind: 'comparison',
          targetDataVersion: '1.0',
          variants: [
            {
              id: 'fixture.locale.view',
              supports: () => ({ supported: true, reason: 'fixture' }),
              score: () => 0,
              render: (data, received) => {
                context = received;
                return html`<p>${data.subject}</p>`;
              },
            },
          ],
        },
      ],
    },
  ]);
  compile(
    localizationDocument('fr-FR'),
    { overrides: { 'changes-comparison': 'fixture.locale.view' } },
    registry,
  );
  assert.equal(context.locale, 'fr-FR');
});
