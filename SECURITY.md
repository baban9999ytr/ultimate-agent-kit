# Security Policy

The installer never executes a skill script. It requires reviewed catalog entries for installation, rejects source and destination path traversal, pins source revisions, detects several high-risk instruction patterns, prevents silent overwrite, and removes only destinations in its manifest. Automated checks are advisory, not proof of safety.
