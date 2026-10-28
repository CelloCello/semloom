# Coding Agent skill

The [Semloom skill](../skills/semloom/SKILL.md) guides an Agent through effective Schema export, semantic JSON generation or editing, validation, compilation and output inspection. It supports both a built source checkout and an installed compiled package. The [Agent guide](agent-guide.md) remains the content/workflow reference; the CLI's `schema` command supplies the effective contract, including configured local Plugins.

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

For use inside a report project, first [install the compiled tarball](releases.md#install-an-archive), then run from that project's root:

```sh
node --input-type=module <<'NODE'
import { mkdirSync, symlinkSync } from 'node:fs';
mkdirSync('.agents/skills', { recursive: true });
symlinkSync('../../node_modules/semloom/skills/semloom', '.agents/skills/semloom', 'dir');
NODE
```

Keep this link local unless the team deliberately adopts it as repository configuration. The installed-package link relies on a project-local `node_modules/semloom`; reinstalling the package must restore that target. To use a checkout from a different report project, link to the checkout's absolute `skills/semloom` directory and use its absolute compiled CLI entry while keeping the report project as the working directory.

Codex detects skill changes automatically; if the skill does not appear, restart Codex. Invoke `$semloom` explicitly, for example: “Use $semloom to update this report's comparison with the supplied facts, validate it and rebuild the HTML.” It can also be selected automatically for matching requests. These instructions do not install the skill into a user-global location or change Codex settings.

Other coding Agents need their own skill registration mechanism. Point them at the original skill directory, or use a directory symlink if supported; do not copy `SKILL.md` alone. Windows link permissions and discovery in other Agent hosts are not covered by the local macOS/Linux commands above.

## Verification

`pnpm test:package` verifies that the tarball includes the skill and its linked docs/examples. In temporary projects it resolves checkout and installed-package skill symlinks, exports a Plugin-aware Schema, validates/builds a report, edits one value and rebuilds while checking preserved data and references. It exercises the installed `npx --no-install` entry as well. This checks paths, packaging and CLI workflow; it does not simulate an Agent's automatic skill selection or install a skill into the developer's active Agent configuration.
