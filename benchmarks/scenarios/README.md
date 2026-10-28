# Additional report scenarios

These fixed scenarios extend the sourced comparison benchmark with different content shapes. They replay author-provided data, not fresh model responses. All new numbers and operational statements are explicitly illustrative.

| Case     | Data shape                                                                | Expected current Auto choice |
| -------- | ------------------------------------------------------------------------- | ---------------------------- |
| compact  | Two items/two short fields, including zero and false                      | comparison.cards             |
| pr-daily | Six semantic kinds, review limitations, next steps and timeline           | comparison.table             |
| wide     | Eight items/five fields, long multiline notes, null/empty/negative values | comparison.table             |

`cases.json` specifies each input, stable comparison ID and content-edit task: replace the title and append a stated sentence to the introductory prose. Retain every other value and source. `scripts/scenarios.mjs` loads these deterministic inputs for both the runner and browser fidelity tests.

`pnpm benchmark` compares fixed table, Auto and interactive Auto for initial/edited inputs. It writes reports/timing/byte hashes under `reports/benchmark/scenarios/` and records results in the `scenarios` field of `reports/benchmark/results.json`. Static and interactive modes provide different capabilities; their byte/timing differences do not establish reading quality. The compact scenario makes Auto choose cards while the fixed condition remains table, providing a distinct presentation comparison without presuming that either is better.

`pnpm test:e2e` checks every block's fields/values and references, comparison order, no-JS static output, interactive alternate Views, offline requests, 375px and print. It does not depend on a prior benchmark run. Generated timings and screenshots are excluded from version control. Human preference and controlled repeated Agent-cost experiments remain separate evaluation work.
