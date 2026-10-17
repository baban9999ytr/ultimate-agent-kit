import { join } from 'node:path';

export const adapters = {
    codex: { directory: '.codex/skills', status: 'installation-verified', evidence: 'OpenAI Codex documentation: ~/.codex/skills' },
    'claude-code': { directory: '.claude/skills', status: 'format-validated', evidence: 'Pending official runtime verification' },
    cursor: { directory: '.cursor/skills', status: 'installation-verified', evidence: 'Cursor Skills documentation' },
    'gemini-cli': { directory: '.gemini/skills', status: 'installation-verified', evidence: 'Gemini CLI Agent Skills documentation' },
    'github-copilot': { directory: null, status: 'sdk-session-only', evidence: 'GitHub Copilot SDK skillDirectories documentation' }
} as const;

export type AgentName = keyof typeof adapters;

export function destinationFor(scopeRoot: string, agent: AgentName, skillId: string): string {
    const adapter = adapters[agent];
    if (!adapter) {
        throw new Error(`Unknown agent: ${agent}`);
    }
    if (!adapter.directory) {
        throw new Error(`${agent} has no verified filesystem installation adapter; use its documented SDK session configuration.`);
    }
    if (!/^[a-z0-9-]+$/.test(skillId)) {
        throw new Error('Skill id must be lowercase letters, numbers, and hyphens.');
    }
    return join(scopeRoot, adapter.directory, skillId);
}
