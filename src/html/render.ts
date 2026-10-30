import type { Registry } from '../core/registry.js';
import {
  sourceAnchor,
  type ResolvedDocument,
  type ResolvedSection,
} from '../core/document.js';
import type { PresentationPlan } from '../core/planner.js';
import {
  SemloomError,
  type HtmlFragment,
  type ThemeName,
  type ResolvedPresentation,
  type HierarchyBlock,
} from '../core/types.js';
import { fragment, heading, html, isFragment } from './html.js';
import { stylesheetCss } from './styles/index.js';
import { interactiveCss } from './styles/interactive.js';
import { navigationHash, navigationScript } from './navigation.js';
import { runtimeLicenseText } from './license.js';
import { printThemeCss } from './themes/index.js';
import { layoutPrintCss } from './layouts/document.js';
import { planInteractive } from '../browser/plan.js';
import { bundleInteractive, jsonForHtml } from '../browser/bundle.js';
import { bundleMindmap } from '../browser/mindmap-bundle.js';
import { reportMessages, reportVariant } from '../core/report-messages.js';

export function renderDocument(
  document: ResolvedDocument,
  plan: PresentationPlan,
  registry: Registry,
  theme: string = 'minimal',
  interactive = false,
  presentation: ResolvedPresentation = { base: plan.context.layout },
): string {
  const messages = reportMessages(plan.context.locale);
  const runtimePlan = interactive
    ? planInteractive(document, plan, registry)
    : { blocks: [], adapters: new Map() };
  const runtime = bundleInteractive(runtimePlan);
  const mindmapBlocks = plan.blocks
    .filter(
      (block) =>
        block.kind === 'hierarchy' && block.selected === 'hierarchy.mindmap',
    )
    .map((block) => ({
      id: block.id,
      root: (
        document.blocks.find((item) => item.id === block.id)!
          .data as HierarchyBlock
      ).root,
    }));
  const mindmap = mindmapBlocks.length ? bundleMindmap() : undefined;
  const interactiveBlocks = new Map(
    runtimePlan.blocks.map((block) => [block.id, block]),
  );
  const planned = new Map(plan.blocks.map((b) => [b.id, b]));
  const sourceById = new Map(
    (document.data.sources ?? []).map((s) => [s.id, s]),
  );
  function renderSections(
    sections: ResolvedSection[],
    depth: number,
  ): HtmlFragment[] {
    return sections.map(
      (section) =>
        html`<section aria-labelledby="${section.id}">
          ${heading(depth, section.title, section.id)}${section.blocks.map(
            (block) => {
              const selected = planned.get(block.id)!;
              let content: HtmlFragment;
              try {
                content = registry
                  .variant(block.data.kind, selected.selected)
                  .render(block.data, {
                    ...plan.context,
                    headingLevel: depth + 1,
                  });
                if (!isFragment(content))
                  throw new Error('Renderer must return an HtmlFragment.');
              } catch {
                throw new SemloomError(
                  [
                    {
                      path: block.path,
                      code: 'RENDER_FAILED',
                      message: `Rendering ${selected.selected} failed.`,
                    },
                  ],
                  1,
                );
              }
              const citations = (block.data.sourceIds ?? []).map(
                (id) =>
                  html`<li>
                    <a href="${anchor(sourceAnchor(id))}"
                      >${sourceById.get(id)!.title}</a
                    >
                  </li>`,
              );
              const switching = interactiveBlocks.get(block.id);
              const view = switching
                ? html`<div data-switcher hidden>
                      <label lang="${messages.locale}"
                        >${messages.displayAs}
                        <select
                          disabled
                          aria-controls="semloom-view-${block.id}"
                        >
                          ${!switching.candidates.includes(selected.selected) ? html`<option value="" disabled selected>${messages.currentView}</option>` : ''}${switching.candidates.map(
                            (id) => {
                              const label = reportVariant(
                                id,
                                plan.context.locale,
                                runtimePlan.adapters.get(id)!.label ?? id,
                              );
                              return html`<option
                                value="${id}"
                                lang="${label.locale}"
                                ${id === selected.selected ? fragment(' selected') : ''}
                              >
                                ${label.label}
                              </option>`;
                            },
                          )}
                        </select></label
                      >
                    </div>
                    <p
                      data-switch-error
                      role="alert"
                      lang="${messages.locale}"
                      hidden
                    ></p>
                    <div data-view-host id="semloom-view-${block.id}">
                      ${content}
                    </div>`
                : content;
              return html`<div
                class="block"
                id="${block.id}"
                data-kind="${block.data.kind}"
                data-variant="${selected.selected}"
              >
                ${view}${
                  citations.length
                    ? html`<div class="citations">
                        <span lang="${messages.locale}"
                          >${messages.blockSources}</span
                        >
                        <ul>
                          ${citations}
                        </ul>
                      </div>`
                    : ''
                }
              </div>`;
            },
          )}${renderSections(section.sections, depth + 1)}
        </section>`,
    );
  }
  function toc(sections: ResolvedSection[]): HtmlFragment {
    return html`<ul lang="${plan.context.locale}">
      ${sections.map((s) => html`<li><a href="${anchor(s.id)}" data-section="${s.id}">${s.title}</a>${s.sections.length ? toc(s.sections) : ''}</li>`)}
    </ul>`;
  }
  const sources = document.data.sources ?? [];
  const tocTitle = sources.length ? messages.tocWithSources : messages.toc;
  const assets = registry.assetsFor([
    ...plan.blocks.map((block) => block.selected),
    ...runtimePlan.adapters.keys(),
  ]);
  const page = html`<!doctype html>
    <html
      lang="${plan.context.locale}"
      data-ui-locale="${messages.locale}"
      data-theme="${theme}"
      data-layout="${plan.context.layout}"
      ${presentation.layout ? html`data-layout-id="${presentation.layout.id}"` : ''}
    >
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'sha256-${navigationHash}'${runtime ? ` 'sha256-${runtime.hash}'` : ''}${mindmap ? ` 'sha256-${mindmap.hash}'` : ''}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
        />
        <title>${document.data.title}</title>
        ${fragment(`<!-- Semloom runtime license (report content is separate)\n${runtimeLicenseText}\n-->`)}
        <style>
          ${fragment(stylesheetCss(presentation.theme ?? (theme as ThemeName)) + (runtime ? interactiveCss : ''))}
        </style>
        ${assets.map(
          (asset) =>
            html`<style data-asset="${asset.id}">
              ${fragment(asset.content)}
            </style>`,
        )}
        ${
          presentation.theme || presentation.layout
            ? html`
                <style data-semloom-presentation>
                  ${fragment((presentation.theme?.css ?? '') + '\n' + (presentation.layout?.css ?? ''))}
                </style>
                <style data-semloom-print>
                  ${fragment(printThemeCss + layoutPrintCss)}
                </style>
              `
            : ''
        }
      </head>
      <body>
        <a class="skip-link" href="#semloom-main" lang="${messages.locale}"
          >${messages.skipToContent}</a
        >
        <div class="page">
          <header><h1>${document.data.title}</h1></header>
          ${plan.context.layout === 'sidebar' ? html`<button type="button" class="nav-toggle" data-nav-toggle aria-controls="semloom-toc" aria-expanded="false" lang="${messages.locale}" hidden>${tocTitle}</button>` : ''}
          <nav
            id="semloom-toc"
            data-toc
            aria-label="${messages.toc}"
            lang="${messages.locale}"
          >
            <h2>${tocTitle}</h2>
            ${toc(document.sections)}
            ${sources.length ? html`<p class="toc-sources"><a href="#semloom-sources" data-toc-source>${messages.dataSources}</a></p>` : ''}
          </nav>
          <main id="semloom-main" tabindex="-1">
            ${renderSections(document.sections, 2)}${
              sources.length
                ? html`<section
                    class="sources"
                    aria-labelledby="semloom-sources"
                  >
                    <h2 id="semloom-sources" lang="${messages.locale}">
                      ${messages.sources}
                    </h2>
                    <ol>
                      ${sources.map((s) => html`<li id="${sourceAnchor(s.id)}">${s.url ? html`<a href="${s.url}">${s.title}</a>` : s.title}</li>`)}
                    </ol>
                  </section>`
                : ''
            }
          </main>
          <footer lang="${messages.locale}">${messages.footer}</footer>
        </div>
        ${fragment(`<script data-semloom-navigation>${navigationScript}</script>`)}
        ${runtime ? fragment(`<script type="application/json" id="semloom-interactive-data">${jsonForHtml(runtimePlan.blocks)}</script><script data-semloom-interactive>${runtime.script}</script>`) : ''}
        ${mindmap ? fragment(`<script type="application/json" id="semloom-mindmap-data">${jsonForHtml({ blocks: mindmapBlocks, licenses: mindmap.licenses })}</script><script data-semloom-mindmap>${mindmap.script}</script>`) : ''}
      </body>
    </html>`;
  return page.value + '\n';
}
function anchor(id: string): string {
  return `#${encodeURIComponent(id)}`;
}
