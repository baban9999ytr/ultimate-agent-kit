import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { destinationFor, type AgentName } from './adapters.js';
import { findSkill } from './registry.js';
import { resolvePreset } from './registry.js';
import { scanSkillText } from './security.js';

const manifestName = '.ultimate-agent-kit.json';

async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }

function safeLocalSource(source: any): string {
    if (typeof source.path !== 'string' || source.path.split(/[\\/]/).includes('..') || !source.ref) {
        throw new Error('Skill source must be pinned and free of path traversal.');
    }
    if (source.type === 'git' && source.repository === 'local://agent-skills') {
        const kitRoot = fileURLToPath(new URL('../', import.meta.url));
        return resolve(kitRoot, '..', 'agent-skills', source.path);
    }
    if (source.type !== 'local') throw new Error('Remote Git fetching is intentionally disabled in this release; use a previously verified local source.');
    return resolve(source.path);
}

async function readManifest(scopeRoot: string): Promise<any> {
    const path = join(scopeRoot, manifestName);
    return (await exists(path)) ? JSON.parse(await readFile(path, 'utf8')) : { installs: [] };
}

export async function installSkill(options: { catalog: any[]; skillId: string; agent: AgentName; scopeRoot: string; overwrite?: boolean; dryRun?: boolean }): Promise<any> {
    const skill = findSkill(options.catalog, options.skillId);
    if (!skill.security?.reviewed) throw new Error(`${skill.id} is unreviewed and cannot be installed.`);
    if (skill.compatibility?.[options.agent]?.install !== 'verified') throw new Error(`${skill.id} is not installation-verified for ${options.agent}.`);
    const source = safeLocalSource(skill.source);
    const skillText = await readFile(join(source, 'SKILL.md'), 'utf8');
    const advisories = scanSkillText(skillText);
    if (advisories.length) throw new Error(`${skill.id} has security advisories: ${advisories.join('; ')}`);
    const destination = destinationFor(options.scopeRoot, options.agent, skill.id);
    if (options.dryRun) return { dryRun: true, destination, advisories };
    if (await exists(destination)) {
        if (!options.overwrite) throw new Error(`${skill.id} already exists at ${destination}; use an explicit overwrite decision.`);
        await rm(destination, { recursive: true, force: true });
    }
    const temporary = `${destination}.installing`;
    await rm(temporary, { recursive: true, force: true });
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, temporary, { recursive: true, force: false });
    try {
        await rename(temporary, destination);
    } catch (error: any) {
        if (error?.code !== 'EPERM') throw error;
        // Windows may reject directory rename inside constrained temporary storage.
        await cp(temporary, destination, { recursive: true, force: false });
        await rm(temporary, { recursive: true, force: true });
    }
    const manifest = await readManifest(options.scopeRoot);
    manifest.installs = manifest.installs.filter((entry: any) => !(entry.skillId === skill.id && entry.agent === options.agent));
    manifest.installs.push({ skillId: skill.id, agent: options.agent, destination, sourceRef: skill.source.ref });
    await writeFile(join(options.scopeRoot, manifestName), JSON.stringify(manifest, null, 2) + '\n');
    return { destination, advisories };
}

export async function uninstallSkill(options: { skillId: string; agent: AgentName; scopeRoot: string }): Promise<{ removed: boolean }> {
    const manifest = await readManifest(options.scopeRoot);
    const entry = manifest.installs.find((item: any) => item.skillId === options.skillId && item.agent === options.agent);
    if (!entry) throw new Error('No managed installation found.');
    const expected = destinationFor(options.scopeRoot, options.agent, options.skillId);
    if (resolve(entry.destination) !== resolve(expected)) throw new Error('Manifest destination does not match the managed adapter path.');
    await rm(entry.destination, { recursive: true, force: true });
    manifest.installs = manifest.installs.filter((item: any) => item !== entry);
    await writeFile(join(options.scopeRoot, manifestName), JSON.stringify(manifest, null, 2) + '\n');
    return { removed: true };
}

export async function installPreset(options: { catalog: any[]; preset: { skills: string[] }; agent: AgentName; scopeRoot: string; dryRun?: boolean }): Promise<any> {
    const skills = resolvePreset({ skills: options.catalog }, options.preset);
    if (options.dryRun) {
        return { dryRun: true, skills: skills.map((skill) => skill.id), agent: options.agent };
    }
    const installations = [];
    for (const skill of skills) {
        installations.push(await installSkill({ catalog: options.catalog, skillId: skill.id, agent: options.agent, scopeRoot: options.scopeRoot }));
    }
    return { dryRun: false, installations };
}
