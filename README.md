# Ultimate Agent Kit

A security-conscious, cross-agent installer for reviewed Agent Skills. It installs by copying verified local source content; it never executes skill scripts.

## Working commands

```bash
npm test
node dist/cli.js list
node dist/cli.js search design
node dist/cli.js verify --json
node dist/cli.js install --preset apple-designer --agent codex --dry-run --json
node dist/cli.js install apple-design-expert --agent codex --global
node dist/cli.js install apple-design-expert --agent codex,cursor --project .
node dist/cli.js uninstall apple-design-expert --agent gemini-cli --project .
```

`install` supports reviewed local sources and the bundled development `local://agent-skills` source, scoped explicitly with `--global` or `--project`. It never executes skill scripts. Remote Git fetching and remote update remain deliberately disabled until the pinned public `agent-skills` release is repaired and a checkout verifier is complete.

## Architecture

```text
catalog + presets -> resolver -> security gate -> agent adapter -> atomic copy -> managed manifest
```

The catalog uses pinned revisions, explicit review status, license metadata, attribution, and separate installation/runtime compatibility states. Presets only resolve reviewed skills.

See [compatibility](docs/compatibility.md), [architecture](docs/architecture.md), and [security](SECURITY.md).


WARNING: Beta — Experimental