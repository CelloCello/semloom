# Package installation and verification

Semloom can be used from a source checkout or a compiled `.tgz` archive. The package is `0.1.0-alpha.1`, licensed under MIT, and supports Node 22.14+ within 22.x and Node 24.x. `private: true` prevents publishing to the npm registry; it does not control GitHub repository visibility or local archive installation.

## From source

```sh
git clone https://github.com/CelloCello/semloom.git
cd semloom
pnpm install --frozen-lockfile
pnpm build
pnpm semloom --help
```

The checkout uses pnpm 10.28.2. Compiled output lives in `dist/`; source archives do not include that directory. Build before invoking the CLI or importing the library from a checkout.

## Build an archive

From the source checkout after installing dependencies:

```sh
mkdir -p reports/package
npm pack --pack-destination reports/package
```

`prepack` cleans `dist/` and builds with the locked TypeScript dependency. Package builds omit source maps and their references; normal `pnpm build` retains development source maps. Consumers receive compiled JS/types and do not need pnpm, TypeScript or a build hook.

The package allowlist includes runtime JS, declarations, both READMEs, CHANGELOG, authoring docs, examples and the bundled skill. npm includes LICENSE and package.json. Development inputs, local records, generated reports and dependency caches are excluded. Browser adapters and the browser-safe export are included in `dist/`.

## Install an archive

### Global CLI

Install a compiled archive with npm:

```sh
npm install --global ./semloom-VERSION.tgz
semloom --version
semloom --help
```

Then run `semloom validate report.json` or `semloom build report.json -o report.html` from the report directory. No source checkout, pnpm or TypeScript is needed. npm's global executable directory must be on PATH; on macOS/Linux this is the `bin` directory beneath `npm prefix --global`. Use the same active Node/npm installation when locating, updating or uninstalling the CLI. Uninstall with `npm uninstall --global semloom`.

`npm root --global` locates the installed package and its docs/examples/skill. For example, on macOS/Linux:

```sh
semloom build "$(npm root --global)/semloom/examples/pr-daily.json" -o report.html
```

A global CLI does not make the library available for imports in arbitrary projects. Use a project-local installation for library integration or custom Plugins that import `semloom`. Bundled Plugin modules can remain in the global package, with their config passed by absolute path; see the [Agent guide](agent-guide.md#choose-the-cli).

### Project-local package

In a separate report project:

```sh
npm install /absolute/path/to/semloom-VERSION.tgz
npx --no-install semloom --help
```

Copy `node_modules/semloom/examples` into the report project as `examples`, preserving the complete Plugin directory. Then run:

```sh
npx --no-install semloom validate examples/comparison.json
npx --no-install semloom build examples/comparison.json -o reports/research.html
npx --no-install semloom build examples/report-workflow.json --config examples/editorial-sidebar.json -o reports/report-workflow.html
npx --no-install semloom build examples/comparison.json --config examples/interactive.json -o reports/interactive.html
npx --no-install semloom build examples/comparison-plugin/report.json --config examples/comparison-plugin/presentation.json --interactive -o reports/plugin.html
```

For coding Agent use, follow [skill installation](skills.md). CLI installation and skill registration are separate steps; keep the installed docs/examples with the skill so its references resolve.

Public library entries are ESM (`semloom`, `semloom/browser`) with declaration files. Install them as a project dependency. Compiler/data types from `semloom` work in Node-only TypeScript projects without DOM libs. Import `BrowserAdapter`, `BrowserContext` and `BrowserView` from `semloom/browser` with DOM types enabled. Relative Plugin imports resolve from their declaring module.

Dependencies may need downloading during installation. Compilation and report reading need no network or LLM API key afterward. esbuild uses a platform-specific binary distributed through optional dependencies; do not omit optional dependencies.

## Verify a package

```sh
pnpm test:package
```

This creates a real archive and installs it into a temporary project with install scripts disabled. It checks the CLI/public exports/types and relative documentation links, compiles static/interactive/Plugin examples, and verifies [skill references and workflows](skills.md#verification). TypeScript declaration checks use the checkout's compiler without installing development dependencies in the consumer.

A separate global-install test uses the same archive with npm's normal install lifecycle, a temporary prefix, separate user/global config files and cache, and a child-process PATH. It invokes bare `semloom` from a report project with no local package, exercises Schema/validation/build/edit/Plugin/skill workflows, then uninstalls from that prefix. It checks real npm config contents and the real global package list before and after. No user-global package, shell startup file or persistent PATH setting is changed. These checks use only runtime dependencies in the installed packages.

Manifests, checksums, logs and per-runtime receipts are written to ignored `reports/package/`. To verify with another installed Node executable:

```sh
pnpm test:package --node /absolute/path/to/node
```

Repeat `--node` to install the same archive under multiple runtimes. `SHA256SUMS` identifies the tested artifact. Results apply to the tested runtime/platform; browser rendering is covered separately by `pnpm test:e2e`. The CI workflow configures Node 22.14/24 on Ubuntu/macOS and retains verification artifacts. It does not publish packages or create releases.

Use a maintained patch release within the supported Node lines. Node 22.14 is the feature minimum; other major versions are outside the declared support range. See the [Node release policy](https://nodejs.org/en/about/previous-releases).

## Distribution and versioning

A compiled archive can be downloaded and installed from a GitHub Release asset when one is published. Installing an asset URL uses npm as an installer and does not require registry publication. Direct Git dependency installation is not a substitute for a compiled archive: the repository omits `dist/`, and Git install lifecycles need their own build setup. Clone/build or use a compiled `.tgz`. See [npm's Git-install behavior](https://docs.npmjs.com/cli/v11/commands/npm-install/).

Package version, `pluginApiVersion`, kind `dataVersion`, Document `schemaVersion` and individual Plugin versions have separate responsibilities. Changing the package label does not change a Plugin identifier or exact dependency requirements.

Generated HTML contains the MIT notice for embedded Semloom runtime code. That notice does not grant rights to input content or cited sources. See the [license](../LICENSE) and [evaluation methodology](evaluation.md).
