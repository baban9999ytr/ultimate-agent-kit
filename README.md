# Ultimate Agent Kit

A security-conscious, cross-agent installer for reviewed Agent Skills. It installs by copying verified local source content; it never executes skill scripts.

## Working commands

```bash
npm test
node dist/cli.js list
node dist/cli.js search design
node dist/cli.js verify --json
node dist/cli.js install --preset apple-designer --agent codex --dry-run --json
node dist/cli.js install apple-design-expert --agent gemini-cli
node dist/cli.js uninstall apple-design-expert --agent gemini-cli
```

`install` currently supports reviewed local sources and the bundled development `local://agent-skills` source. Remote Git fetching, global installation, and remote update are deliberately not yet implemented; the CLI refuses them rather than making an unsafe guess.

## Architecture

```text
catalog + presets -> resolver -> security gate -> agent adapter -> atomic copy -> managed manifest
```

The catalog uses pinned revisions, explicit review status, license metadata, attribution, and separate installation/runtime compatibility states. Presets only resolve reviewed skills.

See [compatibility](docs/compatibility.md), [architecture](docs/architecture.md), and [security](SECURITY.md).
