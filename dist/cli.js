#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adapters, parseAgents } from "./adapters.js";
import {
  installPreset,
  installSkill,
  uninstallSkill,
  updateSkill,
} from "./installer.js";
import { findSkill, validateCatalog } from "./registry.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(
  await readFile(join(root, "catalog/skills.json"), "utf8"),
);
const args = process.argv.slice(2);
const command = args.shift();
const value = args.shift();
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const json = args.includes("--json");
const output = (result) =>
  console.log(
    json
      ? JSON.stringify(result, null, 2)
      : typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2),
  );
const scopeRoot = () => {
  const selected = args.includes("--global")
    ? homedir()
    : resolve(flag("--project") ?? process.cwd());
  if (selected === resolve(root))
    throw new Error(
      "Refusing to install into the ultimate-agent-kit repository root. Use a consumer project path or --global.",
    );
  return selected;
};
const agents = () => parseAgents(flag("--agent") ?? "codex");
if (args.includes("--global") && args.includes("--project"))
  throw new Error("Choose either --global or --project, not both.");
if (command === "list")
  output(
    catalog.skills.map((skill) => ({
      id: skill.id,
      description: skill.description,
      reviewed: skill.security.reviewed,
    })),
  );
else if (command === "search")
  output(
    catalog.skills.filter((skill) =>
      JSON.stringify(skill)
        .toLowerCase()
        .includes((value ?? "").toLowerCase()),
    ),
  );
else if (command === "verify")
  output({ catalogErrors: validateCatalog(catalog.skills), adapters });
else if (command === "show" && value) output(findSkill(catalog.skills, value));
else if (command === "install" && value === "--preset") {
  const preset = JSON.parse(
    await readFile(join(root, `presets/${args.shift()}.json`), "utf8"),
  );
  output(
    await Promise.all(
      agents().map((agent) =>
        installPreset({
          catalog: catalog.skills,
          preset,
          agent,
          scopeRoot: scopeRoot(),
          dryRun: args.includes("--dry-run"),
        }),
      ),
    ),
  );
} else if (command === "install" && value)
  output(
    await Promise.all(
      agents().map((agent) =>
        installSkill({
          catalog: catalog.skills,
          skillId: value,
          agent,
          scopeRoot: scopeRoot(),
          overwrite: args.includes("--overwrite"),
          dryRun: args.includes("--dry-run"),
        }),
      ),
    ),
  );
else if (command === "update" && value)
  output(
    await Promise.all(
      agents().map((agent) =>
        updateSkill({
          catalog: catalog.skills,
          skillId: value,
          agent,
          scopeRoot: scopeRoot(),
          dryRun: args.includes("--dry-run"),
        }),
      ),
    ),
  );
else if (command === "uninstall" && value)
  output(
    await Promise.all(
      agents().map((agent) =>
        uninstallSkill({ skillId: value, agent, scopeRoot: scopeRoot() }),
      ),
    ),
  );
else
  output(
    "Usage: ultimate-agent-kit <list|search|show|verify|install|update|uninstall> [skill] --agent codex,cursor [--global|--project path] [--json]",
  );
