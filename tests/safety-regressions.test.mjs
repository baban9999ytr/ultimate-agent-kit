import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { uninstallSkill } from "../dist/installer.js";
import { validateCatalog } from "../dist/registry.js";

const run = promisify(execFile);

test("CLI refuses its own repository as an installation project", async () => {
  await assert.rejects(
    () =>
      run(
        process.execPath,
        [
          "dist/cli.js",
          "install",
          "apple-design-expert",
          "--project",
          ".",
          "--dry-run",
        ],
        { cwd: process.cwd() },
      ),
    /Refusing to install/,
  );
});

test("dry run in an isolated consumer directory creates no installation artifacts", async (t) => {
  const consumer = await mkdtemp(join(tmpdir(), "uak-consumer-"));
  t.after(() => rm(consumer, { recursive: true, force: true }));
  const result = await run(
    process.execPath,
    [
      "dist/cli.js",
      "install",
      "apple-design-expert",
      "--project",
      consumer,
      "--dry-run",
    ],
    { cwd: process.cwd() },
  );
  assert.match(result.stdout, /dryRun/);
  await assert.rejects(() =>
    readFile(join(consumer, ".ultimate-agent-kit.lock.json"), "utf8"),
  );
});

test("uninstall rejects a manifest that points outside its adapter destination", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "uak-cleanup-"));
  const outside = join(root, "outside");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(outside);
  await writeFile(join(outside, "keep.txt"), "user file");
  await writeFile(
    join(root, ".ultimate-agent-kit.lock.json"),
    JSON.stringify({
      installs: [
        {
          skillId: "sample-skill",
          agent: "codex",
          destination: outside,
          treeHash: "x",
        },
      ],
    }),
  );
  await assert.rejects(
    () =>
      uninstallSkill({
        skillId: "sample-skill",
        agent: "codex",
        scopeRoot: root,
      }),
    /Lockfile destination/,
  );
  assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "user file");
});

test("catalog validation rejects mutable Git references and non-GitHub Git origins", () => {
  const errors = validateCatalog([
    {
      id: "bad",
      source: {
        type: "git",
        repository: "https://example.test/a.git",
        path: "skills/bad",
        ref: "main",
      },
      license: "MIT",
    },
  ]);
  assert.equal(
    errors.some((error) => error.includes("immutable Git SHA")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("canonical GitHub")),
    true,
  );
});
