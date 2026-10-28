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

Public library entries are ESM (`semloom`, `semloom/browser`) with declaration files. Compiler/data types from `semloom` work in Node-only TypeScript projects without DOM libs. Import `BrowserAdapter`, `BrowserContext` and `BrowserView` from `semloom/browser` with DOM types enabled. Relative Plugin imports resolve from their declaring module.

Dependencies may need downloading during installation. Compilation and report reading need no network or LLM API key afterward. esbuild uses a platform-specific binary distributed through optional dependencies; do not omit optional dependencies.

## Verify a package

```sh
pnpm test:package
```

This creates a real archive, installs it into a temporary consumer with install scripts disabled, checks the CLI/public exports/types and relative documentation links, and compiles static, interactive and Plugin examples using runtime dependencies. It also verifies [skill references and workflows](skills.md#verification). TypeScript declaration checks use the checkout's compiler without installing development dependencies in the consumer.

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
