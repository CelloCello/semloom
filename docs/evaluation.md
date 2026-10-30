# Evaluation method and limits

The compiler is evaluated with fixed inputs and actual browser checks. A successful build is not proof that an author supplied true facts, and smaller JSON or HTML is not a token-efficiency measurement.

## Conditions

The sourced JSON Schema/JTD report compares fixed Agent-authored HTML, fixed table, Auto and a cards Override, with an explicit title/prose edit. Theme/Layout cases retain the same semantic input. Interactive cases add the ability to switch browser-enabled Views and therefore include additional code and data.

Three additional illustrative scenarios broaden data shapes: compact comparisons with zero/false values, the six-kind PR daily report, and wide multiline data with null/empty/negative values. Initial/edit tasks run through fixed table, Auto and interactive Auto. Current Auto selects cards for compact data and table for the other two. That distinction provides a presentation comparison, not evidence that Auto looks better to readers.

From a source checkout, `pnpm benchmark` records byte counts, SHA-256, selected Variants, first/subsequent in-process compile timings, static cold CLI timings and environment/dependency versions. Subsequent calls reuse the process and may reuse OS/bundler state; they are not a compiled-validator-cache experiment. The complete reproducible fixtures and methods live in the checkout's `benchmarks/` directory; they are development inputs and are not shipped in the runtime tarball. Per-run measurements are ignored artifacts, never portable performance thresholds.

`pnpm test:e2e` independently builds fixtures and checks actual content/source fidelity, comparison order and missing values, desktop/375px, offline operation without automatic remote requests, no-JS output, print and interactive lifecycle. Benchmark outputs are not test inputs. Installed-archive verification separately checks packaging, runtime-only dependencies, public exports and Plugin/browser entry resolution.

## Interpretation

The separate [report workflows](../examples/report-workflows/README.md) exercise three content tasks with prescribed edits, unchanged data/IDs/references, explicit Variants and external presentation changes. Their unit/CLI and Chromium tests check fidelity and usable output, including exact code whitespace and complete tree fallback. They do not add model responses, usage measurements or new benchmark conditions.

The original fixed and Auto conditions choose the same table; this does not establish a Planner-quality gain. Direct baselines have different styling and do not duplicate all interactive features. Browser navigation timings are proxies, not human reading time or a guaranteed first-paint measurement. Different Node versions, hardware, dependency caches, templates and features confound unpaired comparisons.

Artifact replay does not generate new model responses. A controlled efficiency study would need independent/counterbalanced tasks, prompts and effective Schema, model/version, input/output usage, retries, complete wall-clock timing and predefined fidelity/quality scoring. No result is required to beat another tool. This project does not claim general token savings, superior Planner quality or human preference from the fixed samples.

Local browser automation uses Chromium; native OS select menus and other browser engines need separate checks. Local runtime/platform observations and future CI configuration must be distinguished from completed hosted CI runs. See [release verification](releases.md) and [showcase recipes](showcase.md).
