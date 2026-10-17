import { join } from 'node:path';

export const adapters = {
    codex: { directory: '.codex/skills', status: 'filesystem-tested', evidence: 'Codex Agent Skills directory contract' },
    'claude-code': { directory: '.claude/skills', status: 'format-validated', evidence: 'Compatibility path only; Claude runtime remains untested.' },
    cursor: { directory: '.cursor/skills', status: 'filesystem-tested', evidence: 'Cursor Skills documentation' },
    'gemini-cli': { directory: '.gemini/skills', status: 'filesystem-tested', evidence: 'Gemini CLI Agent Skills documentation' },
    'github-copilot': { directory: null, status: 'sdk-session-only', evidence: 'GitHub Copilot SDK skillDirectories documentation' }
} as const;

export type AgentName = keyof typeof adapters;
export type Scope = 'global' | 'project';

export function parseAgents(value: string): AgentName[] {
    const names = value.split(',').map((name) => name.trim()).filter(Boolean) as AgentName[];
    if (!names.length || names.some((name) => !(name in adapters))) throw new Error('Specify supported agents separated by commas.');
    return [...new Set(names)];
}

export function destinationFor(scopeRoot: string, agent: AgentName, skillId: string): string {
    const adapter = adapters[agent];
    if (!adapter?.directory) throw new Error(`${agent} has no verified filesystem installation adapter.`);
    if (!/^[a-z0-9-]+$/.test(skillId)) throw new Error('Skill id must be lowercase letters, numbers, and hyphens.');
    return join(scopeRoot, adapter.directory, skillId);
}
