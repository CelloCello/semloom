# Coding Agent skill

The [Semloom skill](../skills/semloom/SKILL.md) guides an Agent through effective Schema export, semantic JSON generation or editing, validation, compilation and output inspection. It supports a built source checkout, a project-local package and a global CLI. The [Agent guide](agent-guide.md) remains the content/workflow reference; the CLI's `schema` command supplies the effective contract, including configured local Plugins.

Installing the `.tgz` installs the CLI and skill files. Registering the skill with an Agent is a separate step. Keep the complete checkout or installed package: the skill links to its sibling docs and examples rather than embedding copies. The Agent must resolve a symlink's real path before opening those relative references.

## Codex project installation

Codex scans repository `.agents/skills` directories and supports symlinked skill folders. See [the official skill documentation](https://learn.chatgpt.com/docs/build-skills) for discovery locations and other scopes. The examples below create a project-local link on macOS/Linux and fail if that destination already exists; inspect an existing installation before changing it.

For use inside the Semloom checkout, run from its root after installing dependencies and building:

```sh
node --input-type=module <<'NODE'
import { mkdirSync, symlinkSync } from 'node:fs';
mkdirSync('.agents/skills', { recursive: true });
symlinkSync('../../skills/semloom', '.agents/skills/semloom', 'dir');
NODE
```

For a project-local package, first [install the compiled tarball](releases.md#install-an-archive), then run from the report project's root:

```sh
node --input-type=module <<'NODE'
import { mkdirSync, symlinkSync } from 'node:fs';
mkdirSync('.agents/skills', { recursive: true });
symlinkSync('../../node_modules/semloom/skills/semloom', '.agents/skills/semloom', 'dir');
NODE
```

For an already installed [global CLI](releases.md#global-cli), first check `semloom --version` and `npm root --global` using the same active Node/npm installation. From the report project's root:

```sh
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { accessSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
const modules = execFileSync('npm', ['root', '--global'], { encoding: 'utf8' }).trim();
const skill = join(modules, 'semloom', 'skills', 'semloom');
accessSync(join(skill, 'SKILL.md'));
mkdirSync('.agents/skills', { recursive: true });
symlinkSync(skill, '.agents/skills/semloom', 'dir');
NODE
```

This registers the skill only in that report project and does not install a CLI or modify npm settings. If PATH selects a CLI from another prefix, link the skill from that executable's actual package instead. Global upgrades retain the link only while the package stays at the same location; uninstalling the CLI removes its target. Remove an obsolete link before registering a different installation.

Keep this link local unless the team deliberately adopts it as repository configuration. The installed-package link relies on a project-local `node_modules/semloom`; reinstalling the package must restore that target. To use a checkout from a different report project, link to the checkout's absolute `skills/semloom` directory and use its absolute compiled CLI entry while keeping the report project as the working directory.

The global CLI builds documents without a project-local package. Library imports and custom Plugin modules still follow Node's module resolution; see the [Agent guide](agent-guide.md#choose-the-cli). Registering a skill does not alter module resolution.

Codex detects skill changes automatically; if the skill does not appear, restart Codex. Invoke `$semloom` explicitly, for example: “Use $semloom to update this report's comparison with the supplied facts, validate it and rebuild the HTML.” It can also be selected automatically for matching requests. These instructions do not install the skill into a user-global location or change Codex settings.

Other coding Agents need their own skill registration mechanism. Point them at the original skill directory, or use a directory symlink if supported; do not copy `SKILL.md` alone. Windows link permissions and discovery in other Agent hosts are not covered by the local macOS/Linux commands above.

## Verification

`pnpm test:package` verifies that the tarball includes the skill and its linked docs/examples. Temporary projects exercise checkout, project-local and global CLI entries, skill symlinks, Plugin-aware Schema, validation, compilation and edits while checking preserved data/references. The global test uses a temporary prefix, separate npm user/global config files and cache, and a child-process PATH. It installs and uninstalls there, and checks that real npm configs and global packages remain unchanged. This checks paths, packaging and CLI workflow; it does not simulate an Agent's automatic skill selection or install a skill into the developer's active Agent configuration.
