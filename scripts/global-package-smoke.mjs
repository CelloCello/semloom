import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, sep } from 'node:path';

async function fileHash(file) {
  try {
    return createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function entries(directory) {
  try {
    return (await readdir(directory)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function smokeGlobalPackage({
  archive,
  binary,
  env,
  run,
  version,
}) {
  const sandbox = await mkdtemp(join(tmpdir(), 'semloom-global-'));
  const prefix = join(sandbox, 'prefix');
  const project = join(sandbox, 'report-project');
  const userConfig = join(sandbox, 'user.npmrc');
  const globalConfig = join(sandbox, 'global.npmrc');
  const cache = join(sandbox, 'cache');
  await mkdir(prefix);
  await mkdir(project);
  await writeFile(userConfig, '');
  await writeFile(globalConfig, '');

  // Read the real settings without using the real npm cache or update notifier.
  const queryEnv = Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !/^npm_config_(cache|update_notifier)$/iu.test(key),
    ),
  );
  Object.assign(queryEnv, {
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  });
  const query = (...args) => run('npm', args, project, queryEnv).trim();
  const realPrefix = query('prefix', '--global');
  const realModules = query('root', '--global');
  const configFiles = [
    query('config', 'get', 'userconfig'),
    query('config', 'get', 'globalconfig'),
  ];
  const snapshot = async () => ({
    configs: await Promise.all(configFiles.map(fileHash)),
    modules: await entries(realModules),
    semloomManifest: await fileHash(join(realModules, 'semloom/package.json')),
  });
  const before = await snapshot();
  assert.notEqual(prefix, realPrefix);

  const binDirectory =
    process.platform === 'win32' ? prefix : join(prefix, 'bin');
  // Drop inherited npm settings, then explicitly isolate every writable scope.
  const isolatedEnv = Object.fromEntries(
    Object.entries(env).filter(([key]) => !/^npm_config_/iu.test(key)),
  );
  Object.assign(isolatedEnv, {
    PATH: `${binDirectory}${delimiter}${env.PATH}`,
    NPM_CONFIG_PREFIX: prefix,
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  });
  const npm = (...args) => run('npm', args, project, isolatedEnv).trim();
  const invoke = (...args) =>
    process.platform === 'win32'
      ? run(
          'cmd.exe',
          ['/d', '/s', '/c', 'semloom', ...args],
          project,
          isolatedEnv,
        )
      : run('semloom', args, project, isolatedEnv);
  const result = { prefix, project, outputs: {} };
  let scopeVerified = false;
  try {
    assert.equal(
      await realpath(npm('prefix', '--global')),
      await realpath(prefix),
    );
    scopeVerified = true;
    npm(
      'install',
      '--global',
      '--prefix',
      prefix,
      archive,
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
    );
    const modules = npm('root', '--global');
    assert.ok(
      (await realpath(modules)).startsWith((await realpath(prefix)) + sep),
    );
    const installed = join(modules, 'semloom');
    const executable = join(
      binDirectory,
      process.platform === 'win32' ? 'semloom.cmd' : 'semloom',
    );
    await access(executable);
    if (process.platform !== 'win32')
      assert.equal(
        await realpath(executable),
        await realpath(join(installed, 'dist/cli/main.js')),
      );
    assert.equal(invoke('--version').trim(), version);
    assert.match(invoke('--help'), /--interactive/u);
    JSON.parse(invoke('schema'));
    assert.ok(!(await entries(project)).includes('node_modules'));

    await cp(
      join(installed, 'examples/comparison.json'),
      join(project, 'report.json'),
    );
    invoke('validate', 'report.json');
    invoke(
      'build',
      'report.json',
      '--theme',
      'midnight',
      '--layout',
      'sidebar',
      '--interactive',
      '--explain',
      '-o',
      'basic.html',
    );
    const basic = await readFile(join(project, 'basic.html'), 'utf8');
    assert.ok(basic.includes('data-theme="midnight"'));
    assert.ok(basic.includes('data-semloom-interactive'));
    run(
      binary,
      [
        '--input-type=module',
        '-e',
        "try { await import('semloom'); throw new Error('Global CLI must not supply a project dependency.'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }",
      ],
      project,
      isolatedEnv,
    );
    result.libraryRequiresLocalInstall = true;

    // Register the skill exactly as in the global-install documentation.
    const link = join(project, '.agents/skills/semloom');
    await mkdir(dirname(link), { recursive: true });
    await symlink(
      join(installed, 'skills/semloom'),
      link,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const skill = await realpath(link);
    assert.equal(
      await realpath(join(skill, '../..')),
      await realpath(installed),
    );
    const instructions = await readFile(join(skill, 'SKILL.md'), 'utf8');
    for (const match of instructions.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))
      await access(join(skill, match[1].split('#')[0]));

    // Modules kept inside their installation resolve the Semloom self-reference.
    const config = join(
      installed,
      'examples/comparison-plugin/presentation.json',
    );
    const schema = JSON.parse(invoke('schema', '--config', config));
    assert.ok(
      schema.definitions.block.oneOf.some(
        (kind) => kind.properties.kind.const === 'example.note',
      ),
    );
    JSON.parse(invoke('plugins', 'list', '--config', config));
    const document = JSON.parse(
      await readFile(
        join(installed, 'examples/comparison-plugin/report.json'),
        'utf8',
      ),
    );
    const originalText = document.sections[0].blocks[0].text;
    let originalHtml;
    for (const text of [originalText, 'Global CLI workflow edit']) {
      document.sections[0].blocks[0].text = text;
      await writeFile(join(project, 'report.json'), JSON.stringify(document));
      invoke('validate', 'report.json', '--config', config);
      invoke(
        'build',
        'report.json',
        '--config',
        config,
        '--interactive',
        '--explain',
        '-o',
        'plugin.html',
      );
      const html = await readFile(join(project, 'plugin.html'), 'utf8');
      assert.ok(html.includes('data-variant="example.comparison.rows"'));
      assert.match(html, /href="#semloom-source-sample"/u);
      if (originalHtml)
        assert.equal(html, originalHtml.replace(originalText, text));
      else originalHtml = html;
    }
    for (const name of ['basic', 'plugin']) {
      const file = join(project, `${name}.html`);
      result.outputs[name] = { path: file, sha256: await fileHash(file) };
    }
    assert.ok(!(await entries(project)).includes('node_modules'));
    result.skill = skill;
    result.version = version;
    return result;
  } finally {
    try {
      if (scopeVerified) {
        npm(
          'uninstall',
          '--global',
          '--prefix',
          prefix,
          'semloom',
          '--no-audit',
          '--no-fund',
        );
        assert.ok(
          !(await entries(binDirectory))?.includes(
            process.platform === 'win32' ? 'semloom.cmd' : 'semloom',
          ),
        );
        assert.ok(
          !(await entries(npm('root', '--global')))?.includes('semloom'),
        );
        result.uninstalled = true;
      }
    } finally {
      assert.deepEqual(
        await snapshot(),
        before,
        'Real npm configs and global packages must remain unchanged.',
      );
      result.realGlobalStateUnchanged = true;
    }
  }
}
