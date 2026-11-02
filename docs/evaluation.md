# Evaluation method and limits

The compiler is evaluated with fixed inputs and actual browser checks. A successful build is not proof that an author supplied true facts, and smaller JSON or HTML is not a token-efficiency measurement.

## Conditions

The sourced JSON Schema/JTD report compares fixed Agent-authored HTML, fixed table, Auto and a cards Override, with an explicit title/prose edit. Theme/Layout cases retain the same semantic input. Interactive cases add the ability to switch browser-enabled Views and therefore include additional code and data.

Three additional illustrative scenarios broaden data shapes: compact comparisons with zero/false values, the six-kind PR daily report, and wide multiline data with null/empty/negative values. Initial/edit tasks run through fixed table, Auto and interactive Auto. Current Auto selects cards for compact data and table for the other two. That distinction provides a presentation comparison, not evidence that Auto looks better to readers.

From a source checkout, `pnpm benchmark` records byte counts, SHA-256, selected Variants, first/subsequent in-process compile timings, static cold CLI timings and environment/dependency versions. Calls in one process reuse the private built-in Registry and compiled validators, and may reuse OS/bundler state. A condition's first call can already benefit from earlier conditions; it is not necessarily a cold compile. Cold CLI samples launch separate processes and cannot share these in-process caches. The complete reproducible fixtures and methods live in the checkout's `benchmarks/` directory; they are development inputs and are not shipped in the runtime tarball. Per-run measurements are ignored artifacts, never portable performance thresholds.

`pnpm test:e2e` independently builds fixtures and checks actual content/source fidelity, comparison order and missing values, desktop/375px, offline operation without automatic remote requests, no-JS output, print and interactive lifecycle. Benchmark outputs are not test inputs. Installed-archive verification separately checks packaging, runtime-only dependencies, public exports and Plugin/browser entry resolution.

`pnpm check` runs type, lint and formatting checks, builds once, then runs the complete Node and Chromium suites through `test:built` and `test:e2e:built`. Those two scripts require an existing current build. Standalone `pnpm test` and `pnpm test:e2e` each build first. For before/after verification timings, use the same Node version, browser, workers and test matrix, retain command logs, and compare benchmark hashes and selections as well as elapsed time. Added regression cases should be reported separately from the preserved suite.

CLI and report-workflow Node tests share a per-process pool capped at two child processes. Each invocation uses its owning test's AbortSignal: cancellation or timeout removes that owner's queued work, sends SIGKILL to its running CLI children, and waits for child/stdio close before settling and releasing slots. Other owners retain their FIFO positions. Independent CLI cases use separate temporary directories; operations that mutate or protect the same input/output remain sequential. The workflow test retains every CLI command and presentation combination, reusing test validators only for identical exported Schemas. Browser workflow checks collect content, inline runs, nested lists, comparisons, citations, TOC and source data in one DOM snapshot. List structure keeps retrying count/attachment checks; mindmap readiness/geometry, fallback visibility, code CSS, keyboard and navigation waits remain explicit. Negative DOM probes and deferred-list restoration guard those assertions. Browser workers and visual evidence generation are configured independently of this batching.

## Interpretation

The separate [report workflows](../examples/report-workflows/README.md) exercise three content tasks with prescribed edits, unchanged data/IDs/references, explicit Variants and external presentation changes. Their unit/CLI and Chromium tests check fidelity and usable output, including exact code whitespace and complete tree fallback. They do not add model responses, usage measurements or new benchmark conditions.

The original fixed and Auto conditions choose the same table; this does not establish a Planner-quality gain. Direct baselines have different styling and do not duplicate all interactive features. Browser navigation timings are proxies, not human reading time or a guaranteed first-paint measurement. Different Node versions, hardware, dependency caches, templates and features confound unpaired comparisons.

Artifact replay does not generate new model responses. A controlled efficiency study would need independent/counterbalanced tasks, prompts and effective Schema, model/version, input/output usage, retries, complete wall-clock timing and predefined fidelity/quality scoring. No result is required to beat another tool. This project does not claim general token savings, superior Planner quality or human preference from the fixed samples.

Local browser automation uses Chromium; native OS select menus and other browser engines need separate checks. Local runtime/platform observations and future CI configuration must be distinguished from completed hosted CI runs. See [release verification](releases.md) and [showcase recipes](showcase.md).
