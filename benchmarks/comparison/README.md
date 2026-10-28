# Comparison scenario

This scenario compares ways of presenting a sourced technical report about JSON Schema and JSON Type Definition. The fixed inputs distinguish documentation-backed facts from the report author's selection judgment. Source URLs are reader-clicked references; the benchmark itself does not fetch them.

## Fixed artifacts

| Artifact                | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `semantic-initial.json` | Initial semantic report, including ordered fields and Block-level source references. |
| `semantic-edited.json`  | The same report with the requested title and prose changes.                          |
| `direct-initial.html`   | Fixed Agent-authored HTML/CSS baseline for the initial task.                         |
| `direct-edited.html`    | Fixed direct-HTML baseline for the edit task.                                        |

Initial task: present the same facts as a complete offline report with title, TOC, prose, ordered comparison, Block references, a source list, mobile layout and print styles. The direct baseline contains authored HTML/CSS. The semantic condition uses the document contract described in [the Agent guide](../../docs/agent-guide.md) and the effective exported Schema. The baseline files are reused as fixtures; running the benchmark does not generate new model responses.

Edit task: change the title to “JSON Schema 與 JTD：契約選型筆記” and append “下一步：以實際輸入測試驗證錯誤訊息。” to the first prose block. Retain every comparison fact and source. Direct HTML must keep the page title and visible heading consistent; semantic input has a single title field.

## Conditions and measurements

Run `pnpm benchmark` from the repository root. [The runner](../../scripts/benchmark.mjs) uses the same semantic inputs, minimal/document appearance and compiler for these conditions:

- Fixed: force `comparison.table` for the initial and edited report.
- Auto: let the Planner choose a Variant for the same inputs.
- Override: force `comparison.cards` for the initial input without rewriting the content.
- Direct: copy the two fixed HTML baselines for size and reading comparisons; no compiler timing is assigned to them.

Appearance/layout task: retain the initial report's facts and sources while switching to warm-paper serif typography and a desktop sidebar, with readable 375px and print output. `direct-editorial-sidebar.html` is an Agent-authored adaptation of the initial direct baseline: its CSS and navigation placement were edited directly. It is a fixed input, contains no JavaScript and retains a visible mobile TOC. Semantic conditions change only config; both fixed table and Auto run with editorial/sidebar. Additional Auto cases isolate minimal/sidebar and editorial/document. No fresh model-generation timing or token comparison is assigned to this fixture adaptation. The compiler's enhanced mobile disclosure/Scroll Spy has no equivalent in this static direct baseline, so these artifacts do not establish interaction-quality parity.

Each compiler condition records one first call and five subsequent calls in the same process. Three additional CLI runs measure process startup plus build and write time. The runner records HTML bytes, SHA-256 hashes, selected Variants, Node/platform/dependency versions, Schema bytes and Agent-guide bytes in `reports/benchmark/results.json`. Subsequent calls reuse the process, not a compiled-validator cache. These timings exclude Agent generation; byte counts are not token estimates.

Run `pnpm test:e2e` after installing Playwright Chromium with `pnpm browsers:install`. [The browser test](../../tests/e2e/benchmark.spec.ts) checks initial/edit data and source fidelity across direct HTML, fixed/Auto and cards, plus the editorial/sidebar appearance task, at desktop/375px, no-JS/offline reading, print visibility and automatic-request absence. It writes screenshots and separate browser-navigation timings under `reports/benchmark/`.

## Interpretation

The initial report has four comparison fields, so Auto currently chooses the same table as Fixed. Equal output is valid and does not demonstrate a Planner-quality gain. Direct baselines and compiler output may differ in styling and HTML size; reading quality requires separate evaluation.

For an Agent-efficiency experiment, record the model/version, prompts, effective Schema and tool instructions, task order, cache conditions, retries, input/output usage and complete task wall-clock time. Use fresh contexts, repeat and counterbalance conditions, and define content/quality scoring before comparing results. Replaying fixed artifacts measures compiler/browser behavior, not fresh model-generation cost. No benchmark success criterion requires one approach to win.

Sources: [Ajv schema-language comparison](https://ajv.js.org/guide/schema-language.html), [Ajv TypeScript support](https://ajv.js.org/guide/typescript.html).
