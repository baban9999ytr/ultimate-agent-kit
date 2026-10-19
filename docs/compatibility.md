# Compatibility Matrix

| Agent                               | Format                             | Filesystem installation             | Runtime test                     |
| ----------------------------------- | ---------------------------------- | ----------------------------------- | -------------------------------- |
| Codex                               | Agent Skills                       | Verified in isolated adapter tests  | Not tested against a live client |
| Cursor                              | `SKILL.md`                         | Verified in isolated adapter tests  | Not tested against a live client |
| Gemini CLI                          | Agent Skills                       | Verified in isolated adapter tests  | Not tested against a live client |
| Claude Code                         | Pending official path verification | Not enabled                         | Not tested                       |
| GitHub Copilot                      | SDK `skillDirectories`             | Session-only; no filesystem adapter | Not tested                       |
| Windsurf, Cline, Roo Code, OpenCode | Research pending                   | Not enabled                         | Not tested                       |

An adapter test verifies a destination contract and file layout, not a vendor runtime. The catalog tracks those states separately.
