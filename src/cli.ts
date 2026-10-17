#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapters } from './adapters.js';
import { installSkill, uninstallSkill } from './installer.js';
import { installPreset } from './installer.js';
import { findSkill, validateCatalog } from './registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(join(root, 'catalog/skills.json'), 'utf8'));
const [command, value, ...rest] = process.argv.slice(2);
const json = rest.includes('--json');
const output = (value: unknown) => console.log(json ? JSON.stringify(value, null, 2) : typeof value === 'string' ? value : JSON.stringify(value, null, 2));

if (command === 'list') output(catalog.skills.map((skill: any) => ({ id: skill.id, description: skill.description, reviewed: skill.security.reviewed })));
else if (command === 'search') output(catalog.skills.filter((skill: any) => JSON.stringify(skill).toLowerCase().includes((value ?? '').toLowerCase())));
else if (command === 'verify') output({ errors: validateCatalog(catalog.skills), adapters });
else if (command === 'install' && value) {
    if (value === '--preset') {
        const presetId = rest[0];
        const preset = JSON.parse(await readFile(join(root, `presets/${presetId}.json`), 'utf8'));
        const agent = rest[rest.indexOf('--agent') + 1] ?? 'codex';
        output(await installPreset({ catalog: catalog.skills, preset, agent, scopeRoot: process.cwd(), dryRun: rest.includes('--dry-run') }));
        process.exit(0);
    }
    const agent = (rest[rest.indexOf('--agent') + 1] ?? 'codex');
    output(await installSkill({ catalog: catalog.skills, skillId: value, agent, scopeRoot: process.cwd() }));
} else if (command === 'uninstall' && value) {
    const agent = (rest[rest.indexOf('--agent') + 1] ?? 'codex');
    output(await uninstallSkill({ skillId: value, agent, scopeRoot: process.cwd() }));
} else if (command === 'show' && value) output(findSkill(catalog.skills, value));
else output('Usage: ultimate-agent-kit <list|search|show|verify|install|uninstall> [skill] [--agent codex] [--json]');
