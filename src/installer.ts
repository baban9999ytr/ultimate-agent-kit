import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { destinationFor, type AgentName } from "./adapters.js";
import { findSkill, resolvePreset } from "./registry.js";
import { scanSkillText } from "./security.js";

const run = promisify(execFile);
const lockfile = ".ultimate-agent-kit.lock.json";
const maxFiles = 512;
const maxBytes = 10 * 1024 * 1024;
const exists = async (path: string) =>
  access(path)
    .then(() => true)
    .catch(() => false);
const isSha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const inside = (root: string, path: string) =>
  path === root || path.startsWith(root + sep);

function githubUrl(repository: unknown): string {
  if (
    typeof repository !== "string" ||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(
      repository,
    )
  )
    throw new Error(
      "Only canonical https://github.com/owner/repository.git sources are allowed.",
    );
  return repository;
}

async function inspectTree(
  root: string,
): Promise<{ hash: string; bytes: number }> {
  const files: string[] = [];
  let bytes = 0;
  async function walk(directory: string): Promise<void> {
    for (const name of await readdir(directory)) {
      const path = join(directory, name);
      const info = await lstat(path);
      if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
        throw new Error(`Unsafe source entry: ${relative(root, path)}`);
      if (info.isDirectory()) await walk(path);
      else {
        if (files.length >= maxFiles)
          throw new Error("Skill exceeds the 512-file limit.");
        bytes += info.size;
        if (bytes > maxBytes)
          throw new Error("Skill exceeds the 10 MiB limit.");
        files.push(path);
      }
    }
  }
  await walk(root);
  files.sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(root, file).replace(/\\/g, "/"));
    hash.update(await readFile(file));
  }
  return { hash: hash.digest("hex"), bytes };
}

async function acquire(
  source: any,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  if (
    !source ||
    typeof source.path !== "string" ||
    source.path.split(/[\\/]/).includes("..")
  )
    throw new Error("Source requires a traversal-free path.");
  if (source.type === "local") {
    if (typeof source.ref !== "string" || !source.ref)
      throw new Error("Local source requires an integrity reference.");
    return { path: resolve(source.path), cleanup: async () => {} };
  }
  if (!isSha(source.ref))
    throw new Error("Remote source requires a full immutable SHA.");
  const checkout = await mkdtemp(join(tmpdir(), "ultimate-agent-kit-"));
  try {
    await run("git", ["-c", "protocol.file.allow=never", "init", checkout], {
      timeout: 30000,
    });
    await run(
      "git",
      ["-C", checkout, "remote", "add", "origin", githubUrl(source.repository)],
      { timeout: 30000 },
    );
    await run(
      "git",
      ["-C", checkout, "fetch", "--depth=1", "origin", source.ref],
      { timeout: 30000 },
    );
    await run(
      "git",
      ["-C", checkout, "checkout", "--detach", "--force", source.ref],
      { timeout: 30000 },
    );
    const { stdout } = await run("git", ["-C", checkout, "rev-parse", "HEAD"], {
      timeout: 30000,
    });
    if (stdout.trim() !== source.ref)
      throw new Error("Fetched commit does not match its pinned SHA.");
    const path = resolve(checkout, source.path);
    if (!inside(checkout, path))
      throw new Error("Source path escapes checkout.");
    return {
      path,
      cleanup: async () => {
        await rm(checkout, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(checkout, { recursive: true, force: true });
    throw error;
  }
}

async function readLock(scopeRoot: string): Promise<any> {
  const path = join(scopeRoot, lockfile);
  return (await exists(path))
    ? JSON.parse(await readFile(path, "utf8"))
    : { version: 1, installs: [] };
}
async function writeLock(scopeRoot: string, lock: any): Promise<void> {
  await mkdir(scopeRoot, { recursive: true });
  await writeFile(
    join(scopeRoot, lockfile),
    JSON.stringify(lock, null, 2) + "\n",
  );
}
async function withOperationLock<T>(
  scopeRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(scopeRoot, { recursive: true });
  const path = join(scopeRoot, ".ultimate-agent-kit.operation.lock");
  let handle: any;
  try {
    handle = await open(path, "wx");
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return await operation();
  } catch (error: any) {
    if (error?.code === "EEXIST")
      throw new Error(
        "Another Ultimate Agent Kit operation is active for this scope.",
      );
    throw error;
  } finally {
    await handle?.close();
    if (handle) await unlink(path).catch(() => {});
  }
}

async function installUnlocked(options: {
  catalog: any[];
  skillId: string;
  agent: AgentName;
  scopeRoot: string;
  overwrite?: boolean;
  dryRun?: boolean;
}): Promise<any> {
  const skill = findSkill(options.catalog, options.skillId);
  if (!skill.security?.reviewed)
    throw new Error(`${skill.id} is unreviewed and cannot be installed.`);
  if (skill.compatibility?.[options.agent]?.install !== "verified")
    throw new Error(
      `${skill.id} is not installation-verified for ${options.agent}.`,
    );
  const source = await acquire(skill.source);
  try {
    if (!(await exists(join(source.path, "SKILL.md"))))
      throw new Error("Source is missing SKILL.md.");
    const inspection = await inspectTree(source.path);
    const advisories = scanSkillText(
      await readFile(join(source.path, "SKILL.md"), "utf8"),
    );
    if (advisories.length)
      throw new Error(
        `${skill.id} has security advisories: ${advisories.join("; ")}`,
      );
    const destination = destinationFor(
      options.scopeRoot,
      options.agent,
      skill.id,
    );
    if (options.dryRun)
      return {
        dryRun: true,
        destination,
        treeHash: inspection.hash,
        bytes: inspection.bytes,
      };
    if ((await exists(destination)) && !options.overwrite)
      throw new Error(
        `${skill.id} already exists at ${destination}; use --overwrite.`,
      );
    await mkdir(dirname(destination), { recursive: true });
    const staging = `${destination}.installing-${randomUUID()}`;
    const backup = `${destination}.backup-${randomUUID()}`;
    try {
      await cp(source.path, staging, {
        recursive: true,
        force: false,
        verbatimSymlinks: true,
      });
      await inspectTree(staging);
      if (await exists(destination)) await rename(destination, backup);
      await rename(staging, destination);
      await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if ((await exists(backup)) && !(await exists(destination)))
        await rename(backup, destination);
      throw error;
    }
    const lock = await readLock(options.scopeRoot);
    lock.installs = lock.installs.filter(
      (entry: any) =>
        !(entry.skillId === skill.id && entry.agent === options.agent),
    );
    lock.installs.push({
      skillId: skill.id,
      agent: options.agent,
      destination,
      sourceRef: skill.source.ref,
      treeHash: inspection.hash,
      installedAt: new Date().toISOString(),
    });
    await writeLock(options.scopeRoot, lock);
    return { destination, treeHash: inspection.hash, bytes: inspection.bytes };
  } finally {
    await source.cleanup();
  }
}

export async function installSkill(options: {
  catalog: any[];
  skillId: string;
  agent: AgentName;
  scopeRoot: string;
  overwrite?: boolean;
  dryRun?: boolean;
}): Promise<any> {
  if (options.dryRun) return installUnlocked(options);
  return withOperationLock(options.scopeRoot, () => installUnlocked(options));
}

export async function updateSkill(options: {
  catalog: any[];
  skillId: string;
  agent: AgentName;
  scopeRoot: string;
  dryRun?: boolean;
}): Promise<any> {
  const lock = await readLock(options.scopeRoot);
  const installed = lock.installs.find(
    (entry: any) =>
      entry.skillId === options.skillId && entry.agent === options.agent,
  );
  if (!installed) throw new Error("No managed installation found to update.");
  const next = findSkill(options.catalog, options.skillId);
  if (options.dryRun)
    return {
      dryRun: true,
      from: installed.sourceRef,
      to: next.source.ref,
      changed: installed.sourceRef !== next.source.ref,
    };
  return installSkill({ ...options, overwrite: true });
}

export async function uninstallSkill(options: {
  skillId: string;
  agent: AgentName;
  scopeRoot: string;
  force?: boolean;
}): Promise<{ removed: boolean }> {
  const lock = await readLock(options.scopeRoot);
  const entry = lock.installs.find(
    (item: any) =>
      item.skillId === options.skillId && item.agent === options.agent,
  );
  if (!entry) throw new Error("No managed installation found.");
  const expected = destinationFor(
    options.scopeRoot,
    options.agent,
    options.skillId,
  );
  if (resolve(entry.destination) !== resolve(expected))
    throw new Error(
      "Lockfile destination does not match the managed adapter path.",
    );
  if (
    !options.force &&
    (await inspectTree(entry.destination)).hash !== entry.treeHash
  )
    throw new Error(
      "Installed skill was modified; use --force only after review.",
    );
  await rm(entry.destination, { recursive: true, force: true });
  lock.installs = lock.installs.filter((item: any) => item !== entry);
  await writeLock(options.scopeRoot, lock);
  return { removed: true };
}
export async function installPreset(options: {
  catalog: any[];
  preset: { skills: string[] };
  agent: AgentName;
  scopeRoot: string;
  dryRun?: boolean;
}): Promise<any> {
  const skills = resolvePreset({ skills: options.catalog }, options.preset);
  return {
    dryRun: !!options.dryRun,
    installations: await Promise.all(
      skills.map((skill) =>
        installSkill({
          catalog: options.catalog,
          skillId: skill.id,
          agent: options.agent,
          scopeRoot: options.scopeRoot,
          dryRun: options.dryRun,
        }),
      ),
    ),
  };
}
