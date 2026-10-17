import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installPreset, installSkill, uninstallSkill } from '../dist/installer.js';
import { resolvePreset } from '../dist/registry.js';

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'ultimate-agent-kit-'));
    const source = join(root, 'source', 'sample-skill');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'SKILL.md'), '---\nname: sample-skill\ndescription: Test skill\n---\n# Test\n');
    return { root, source };
}

test('installs and removes a reviewed, pinned local skill without touching real agent directories', async (t) => {
    const { root, source } = await fixture();
    t.after(() => rm(root, { recursive: true, force: true }));
    const catalog = [{ id: 'sample-skill', source: { type: 'local', path: source, ref: 'sha256:test' }, security: { reviewed: true }, compatibility: { codex: { install: 'verified' } } }];
    const installed = await installSkill({ catalog, skillId: 'sample-skill', agent: 'codex', scopeRoot: join(root, 'target') });
    assert.match(installed.destination, /\.codex[\\/]skills[\\/]sample-skill$/);
    assert.equal((await readFile(join(installed.destination, 'SKILL.md'), 'utf8')).includes('Test skill'), true);
    await assert.rejects(() => installSkill({ catalog, skillId: 'sample-skill', agent: 'codex', scopeRoot: join(root, 'target') }));
    const removed = await uninstallSkill({ skillId: 'sample-skill', agent: 'codex', scopeRoot: join(root, 'target') });
    assert.equal(removed.removed, true);
});

test('rejects unsafe paths and unreviewed preset entries', async () => {
    await assert.rejects(() => installSkill({ catalog: [{ id: 'bad', source: { type: 'local', path: '../escape', ref: '' }, security: { reviewed: true }, compatibility: { codex: { install: 'verified' } } }], skillId: 'bad', agent: 'codex', scopeRoot: tmpdir() }));
    assert.throws(() => resolvePreset({ skills: [{ id: 'safe', security: { reviewed: true } }, { id: 'pending', security: { reviewed: false } }] }, { skills: ['safe', 'pending'] }));
});

test('resolves an original development skill from its pinned local git source', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'ultimate-agent-kit-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const catalog = [{ id: 'apple-design-expert', source: { type: 'git', repository: 'local://agent-skills', path: 'skills/apple-design-expert', ref: '635092f8cd9177ede8bfa0e24a333827152c5ea2' }, security: { reviewed: true }, compatibility: { 'gemini-cli': { install: 'verified' } } }];
    const installed = await installSkill({ catalog, skillId: 'apple-design-expert', agent: 'gemini-cli', scopeRoot: root });
    assert.equal((await readFile(join(installed.destination, 'SKILL.md'), 'utf8')).includes('Apple Design Expert'), true);
});

test('dry-run preset resolves reviewed compatible skills without writing files', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'ultimate-agent-kit-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const { source } = await fixture();
    const catalog = [{ id: 'sample-skill', source: { type: 'local', path: source, ref: 'sha256:test' }, security: { reviewed: true }, compatibility: { codex: { install: 'verified' } } }];
    const result = await installPreset({ catalog, preset: { skills: ['sample-skill'] }, agent: 'codex', scopeRoot: root, dryRun: true });
    assert.equal(result.dryRun, true);
    await assert.rejects(() => readFile(join(root, '.ultimate-agent-kit.json'), 'utf8'));
});
