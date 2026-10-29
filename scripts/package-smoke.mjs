import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  cp,
  readdir,
  access,
  realpath,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, delimiter, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { smokeGlobalPackage } from './global-package-smoke.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: { node: { type: 'string', multiple: true } },
  strict: true,
});
const runtimes = values.node ?? [process.execPath];
const destination = resolve(root, 'reports/package');
await mkdir(destination, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(root, 'package.json'), 'utf8'),
);
let packedArtifact;

for (const binary of runtimes) {
  const commands = [];
  const env = {
    ...process.env,
    PATH: `${dirname(binary)}${delimiter}${process.env.PATH ?? ''}`,
  };
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, 'Node executable must run.');
  const label = version.stdout.trim();
  const log = [];
  function run(command, args, cwd, commandEnv = env) {
    const result = spawnSync(command, args, {
      cwd,
      env: commandEnv,
      encoding: 'utf8',
      maxBuffer: 8_000_000,
    });
    log.push(
      `$ ${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
    commands.push({ command: [command, ...args], exitCode: result.status });
    if (result.error) throw result.error;
    assert.equal(
      result.status,
      0,
      `${command} failed: ${(result.stderr ?? '').slice(-1500)}`,
    );
    return result.stdout;
  }
  try {
    if (!packedArtifact) {
      await mkdir(resolve(root, 'dist'), { recursive: true });
      await writeFile(
        resolve(root, 'dist/__package_smoke_stale__.js'),
        'throw new Error("stale build artifact");',
      );
      packedArtifact = JSON.parse(
        run(
          'npm',
          [
            'pack',
            '--json',
            '--pack-destination',
            destination,
            '--cache',
            resolve(root, '.cache/npm'),
          ],
          root,
        ),
      )[0];
    }
    // Every selected runtime installs this same archive, not a separately rebuilt one.
    const packed = packedArtifact;
    const archive = resolve(destination, packed.filename);
    const archiveSha256 = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    await writeFile(
      resolve(destination, 'SHA256SUMS'),
      `${archiveSha256}  ${packed.filename}\n`,
    );
    const names = packed.files.map((file) => file.path);
    for (const required of [
      'LICENSE',
      'README.zh-TW.md',
      'docs/assets/themes.webp',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/browser/index.js',
      'dist/browser/runtime.js',
      'dist/browser/adapters/cards.js',
      'dist/browser/adapters/table.js',
      'dist/cli/main.js',
      'docs/interactive.md',
      'docs/releases.md',
      'docs/skills.md',
      'skills/semloom/SKILL.md',
      'examples/comparison.json',
      'examples/pr-daily.json',
      'examples/report-workflow.json',
      'examples/comparison-plugin/browser.mjs',
      'CHANGELOG.md',
    ])
      assert.ok(names.includes(required), `Missing package file: ${required}`);
    assert.ok(
      !names.some(
        (name) =>
          /(?:^|\/)(?:_plans|reports|node_modules|src|tests|scripts|\.DS_Store)(?:\/|$)/u.test(
            name,
          ) ||
          name.endsWith('.map') ||
          name.endsWith('.tsbuildinfo'),
      ),
      'Development files must not enter the archive.',
    );
    assert.ok(
      !names.includes('dist/__package_smoke_stale__.js'),
      'prepack must remove stale artifacts.',
    );
    await writeFile(
      join(destination, `manifest-${label}.json`),
      JSON.stringify(packed, null, 2) + '\n',
    );
    const consumer = await mkdtemp(join(tmpdir(), 'semloom-package-'));
    await writeFile(
      join(consumer, 'package.json'),
      JSON.stringify({
        name: 'semloom-consumer-smoke',
        private: true,
        type: 'module',
      }),
    );
    run(
      'npm',
      [
        'install',
        archive,
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--cache',
        resolve(root, '.cache/npm'),
        '--prefer-offline',
      ],
      consumer,
    );
    const installed = join(consumer, 'node_modules', manifest.name);
    await cp(join(installed, 'examples'), join(consumer, 'examples'), {
      recursive: true,
    });
    const installedManifest = JSON.parse(
      await readFile(join(installed, 'package.json'), 'utf8'),
    );
    assert.equal(installedManifest.version, manifest.version);
    assert.equal(installedManifest.license, 'MIT');
    for (const name of names.filter((name) => name.endsWith('.md'))) {
      const markdown = await readFile(join(installed, name), 'utf8');
      for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
        const link = match[1];
        if (/^[a-z][a-z\d+.-]*:/iu.test(link) || link.startsWith('#')) continue;
        const target = resolve(
          dirname(join(installed, name)),
          decodeURI(link.split('#')[0]),
        );
        assert.ok(
          target.startsWith(installed + sep),
          `Documentation link escapes package: ${name} → ${link}`,
        );
        await access(target);
      }
    }
    const modules = await readdir(join(consumer, 'node_modules'));
    for (const development of [
      'typescript',
      'eslint',
      'prettier',
      '@playwright',
    ])
      assert.ok(
        !modules.includes(development),
        `${development} must not be installed as a runtime dependency.`,
      );
    const cli = join(installed, installedManifest.bin.semloom);
    const installedThemes = JSON.parse(
      run(binary, [cli, 'themes', 'list'], consumer),
    );
    for (const theme of ['ocean', 'graphite', 'signal', 'midnight']) {
      assert.ok(installedThemes.includes(theme));
      run(
        binary,
        [
          cli,
          'build',
          'examples/blocks.json',
          '--theme',
          theme,
          '--layout',
          'sidebar',
          '-o',
          `reports/${theme}.html`,
        ],
        consumer,
      );
      const themed = await readFile(
        join(consumer, `reports/${theme}.html`),
        'utf8',
      );
      assert.ok(themed.includes(`data-theme="${theme}"`));
    }
    const help = run(binary, [cli, '--help'], consumer);
    assert.match(help, /--interactive/u);
    assert.equal(
      run(binary, [cli, '--version'], consumer).trim(),
      manifest.version,
    );
    // Exercise the installed bin link, not just a source checkout entry point.
    const bin = join(
      consumer,
      'node_modules/.bin',
      process.platform === 'win32' ? 'semloom.cmd' : 'semloom',
    );
    run(
      process.platform === 'win32' ? 'cmd.exe' : bin,
      process.platform === 'win32'
        ? ['/d', '/s', '/c', bin, '--help']
        : ['--help'],
      consumer,
    );
    const skillWorkflows = [];
    for (const mode of ['checkout', 'installed']) {
      const project =
        mode === 'installed'
          ? consumer
          : await mkdtemp(join(tmpdir(), 'semloom-checkout-skill-'));
      const toolRoot = mode === 'installed' ? installed : root;
      const entry =
        mode === 'installed'
          ? ['npx', ['--no-install', 'semloom']]
          : [binary, [join(toolRoot, 'dist/cli/main.js')]];
      const invoke = (...args) =>
        run(entry[0], [...entry[1], ...args], project);
      const skillLink = join(project, '.agents/skills/semloom');
      await mkdir(dirname(skillLink), { recursive: true });
      await symlink(
        mode === 'installed' && process.platform !== 'win32'
          ? '../../node_modules/semloom/skills/semloom'
          : join(toolRoot, 'skills/semloom'),
        skillLink,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const physicalSkill = await realpath(skillLink);
      const referenceRoot = resolve(physicalSkill, '../..');
      assert.equal(referenceRoot, await realpath(toolRoot));
      // Resolve every skill reference from its physical location, not .agents/.
      const instructions = await readFile(join(skillLink, 'SKILL.md'), 'utf8');
      for (const match of instructions.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))
        await access(resolve(physicalSkill, match[1].split('#')[0]));
      assert.equal(invoke('--version').trim(), manifest.version);
      const config =
        mode === 'checkout'
          ? join(referenceRoot, 'examples/comparison-plugin/presentation.json')
          : 'examples/comparison-plugin/presentation.json';
      const schemaText = invoke('schema', '--config', config);
      const effectiveSchema = JSON.parse(schemaText);
      assert.ok(
        effectiveSchema.definitions.block.oneOf.some(
          (kind) => kind.properties.kind.const === 'example.note',
        ),
        `${mode}: effective Schema must include the selected Plugin.`,
      );
      await writeFile(join(project, 'semantic.schema.json'), schemaText);
      const document = JSON.parse(
        await readFile(
          join(referenceRoot, 'examples/comparison-plugin/report.json'),
          'utf8',
        ),
      );
      const comparison = structuredClone(document.sections[0].blocks[1]);
      const sources = structuredClone(document.sources);
      const originalText = document.sections[0].blocks[0].text;
      const output = `reports/skill-${mode}.html`;
      for (const text of [originalText, `Skill workflow edit (${mode})`]) {
        document.sections[0].blocks[0].text = text;
        await writeFile(join(project, 'report.json'), JSON.stringify(document));
        invoke('validate', 'report.json', '--config', config);
        invoke(
          'build',
          'report.json',
          '--config',
          config,
          '-o',
          output,
          '--explain',
        );
        const html = await readFile(join(project, output), 'utf8');
        assert.ok(html.includes(text));
        assert.ok(html.includes('data-variant="example.comparison.rows"'));
        for (const item of comparison.items)
          assert.ok(html.includes(item.name));
        for (const source of sources) assert.ok(html.includes(source.title));
        assert.match(html, /href="#semloom-source-sample"/u);
      }
      const saved = JSON.parse(
        await readFile(join(project, 'report.json'), 'utf8'),
      );
      assert.deepEqual(saved.sections[0].blocks[1], comparison);
      assert.deepEqual(saved.sources, sources);
      skillWorkflows.push({ mode, project, physicalSkill, output });
    }
    for (const input of ['comparison', 'pr-daily', 'report-workflow']) {
      const configArgs =
        input === 'report-workflow'
          ? ['--config', 'examples/editorial-sidebar.json']
          : [];
      run(
        binary,
        [cli, 'validate', `examples/${input}.json`, ...configArgs],
        consumer,
      );
      run(
        binary,
        [
          cli,
          'build',
          `examples/${input}.json`,
          ...configArgs,
          '-o',
          `reports/${input}.html`,
        ],
        consumer,
      );
    }
    run(
      binary,
      [
        cli,
        'build',
        'examples/comparison.json',
        '--config',
        'examples/interactive.json',
        '-o',
        'reports/interactive.html',
      ],
      consumer,
    );
    const config = 'examples/comparison-plugin/presentation.json';
    const schema = JSON.parse(
      run(binary, [cli, 'schema', '--config', config], consumer),
    );
    assert.ok(JSON.stringify(schema).includes('example.note'));
    run(
      binary,
      [
        cli,
        'validate',
        'examples/comparison-plugin/report.json',
        '--config',
        config,
      ],
      consumer,
    );
    const plugins = JSON.parse(
      run(binary, [cli, 'plugins', 'list', '--config', config], consumer),
    );
    assert.ok(
      plugins[1].extensions[0].browserVariants.includes(
        'example.comparison.rows',
      ),
    );
    run(
      binary,
      [
        cli,
        'build',
        'examples/comparison-plugin/report.json',
        '--config',
        config,
        '--interactive',
        '-o',
        'reports/plugin-interactive.html',
      ],
      consumer,
    );
    await writeFile(
      join(consumer, 'library-smoke.mjs'),
      `import assert from 'node:assert/strict';\nimport {compile} from ${JSON.stringify(manifest.name)};\nimport {safeUrl} from ${JSON.stringify(`${manifest.name}/browser`)};\nimport {readFileSync} from 'node:fs';\nsafeUrl('https://example.com');\nconst output=compile(JSON.parse(readFileSync('examples/comparison.json','utf8')),{interactive:true});\nassert.ok(output.html.includes('data-semloom-interactive'));\n`,
    );
    run(binary, ['library-smoke.mjs'], consumer);
    const presentationConfig = 'examples/presentation/presentation.json';
    for (const category of ['themes', 'layouts']) {
      const listed = JSON.parse(
        run(
          binary,
          [cli, category, 'list', '--config', presentationConfig],
          consumer,
        ),
      );
      assert.ok(
        listed.includes(
          category === 'themes' ? 'example.paper' : 'example.right-sidebar',
        ),
      );
    }
    run(binary, [cli, 'schema', '--config', presentationConfig], consumer);
    run(
      binary,
      [
        cli,
        'validate',
        'examples/technical-guide.json',
        '--config',
        presentationConfig,
      ],
      consumer,
    );
    run(
      binary,
      [
        cli,
        'build',
        'examples/technical-guide.json',
        '--config',
        presentationConfig,
        '-o',
        'reports/presentation.html',
      ],
      consumer,
    );
    await writeFile(
      join(consumer, 'presentation-smoke.mjs'),
      [
        "import assert from 'node:assert/strict';",
        "import {readFileSync} from 'node:fs';",
        "import {resolve} from 'node:path';",
        `import {compile,parseConfig,loadPresentation,createPresentation} from ${JSON.stringify(manifest.name)};`,
        "const input=JSON.parse(readFileSync('examples/technical-guide.json','utf8'));",
        "const config=parseConfig(JSON.parse(readFileSync('examples/presentation/presentation.json','utf8')));",
        "const catalog=await loadPresentation(config,resolve('examples/presentation'));",
        'const output=compile(input,config,undefined,catalog);',
        "assert.equal(output.html,readFileSync('reports/presentation.html','utf8'));",
        "assert.equal(output.plan.context.layout,'sidebar');",
        'assert.ok(output.html.includes(\'data-layout-id="example.right-sidebar"\'));',
        "assert.ok(output.html.includes('grid-column: 2'));",
        "assert.ok(output.html.includes('font-weight: 600'));",
        "const pure=createPresentation({themes:[{id:'consumer.pure',themeApiVersion:'1.0',tokens:{accent:'#123456'}}],layouts:[{id:'consumer.reading',layoutApiVersion:'1.0',base:'document',css:'.page{max-width:60rem}'}]});",
        "assert.equal(compile(input,{theme:'consumer.pure',layout:'consumer.reading'},undefined,pure).plan.context.layout,'document');",
      ].join('\n'),
    );
    run(binary, ['presentation-smoke.mjs'], consumer);
    await writeFile(
      join(consumer, 'types-node.mts'),
      `import {compile,createPresentation,parseConfig,loadPresentation,type Document,type ThemeDefinition,type LayoutDefinition,type ThemeTokens} from ${JSON.stringify(manifest.name)};\nconst data:Document={schemaVersion:'1.0',title:'T',sections:[{title:'S'}]};\nconst tokens:Partial<ThemeTokens>={accent:'#123456'};\nconst theme:ThemeDefinition={id:'consumer.typed',themeApiVersion:'1.0',tokens};\nconst layout:LayoutDefinition={id:'consumer.typed',layoutApiVersion:'1.0',base:'sidebar'};\nconst catalog=createPresentation({themes:[theme],layouts:[layout]});\nconst output:string=compile(data,{theme:theme.id,layout:layout.id},undefined,catalog).html;\nvoid [output,loadPresentation(parseConfig())];\n`,
    );
    await writeFile(
      join(consumer, 'types-browser.mts'),
      `import {html,htmlView,type BrowserAdapter} from ${JSON.stringify(`${manifest.name}/browser`)};\nconst view:BrowserAdapter=()=>htmlView(html\`<p>View</p>\`);\nvoid view;\n`,
    );
    for (const target of ['node', 'browser']) {
      await writeFile(
        join(consumer, `tsconfig.${target}.json`),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            lib: target === 'node' ? ['ES2022'] : ['ES2022', 'DOM'],
            types: [],
            strict: true,
            noEmit: true,
          },
          files: [`types-${target}.mts`],
        }),
      );
      run(
        binary,
        [
          resolve(root, 'node_modules/typescript/bin/tsc'),
          '-p',
          `tsconfig.${target}.json`,
        ],
        consumer,
      );
    }
    const globalInstall = await smokeGlobalPackage({
      archive,
      binary,
      env,
      run,
      version: manifest.version,
    });
    const outputs = {};
    for (const name of [
      'comparison',
      'pr-daily',
      'report-workflow',
      'interactive',
      'plugin-interactive',
      'presentation',
    ]) {
      const file = join(consumer, `reports/${name}.html`);
      const content = await readFile(file);
      outputs[name] = {
        path: file,
        bytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
      };
    }
    const receipt = {
      node: label,
      platform: process.platform,
      arch: process.arch,
      archive,
      archiveSha256,
      package: manifest.name,
      version: manifest.version,
      fileCount: names.length,
      packedBytes: packed.size,
      consumer,
      commands,
      outputs,
      skillWorkflows,
      globalInstall,
      license: installedManifest.license ?? null,
      private: installedManifest.private ?? false,
      note: 'No registry publication. Local install ignores lifecycle scripts; isolated global install uses the normal lifecycle. Both use runtime dependencies only.',
    };
    await writeFile(
      join(destination, `smoke-${label}.json`),
      JSON.stringify(receipt, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        node: label,
        commands: commands.length,
        files: names.length,
        consumer,
      }),
    );
  } finally {
    await writeFile(join(destination, `smoke-${label}.log`), log.join('\n'));
  }
}
