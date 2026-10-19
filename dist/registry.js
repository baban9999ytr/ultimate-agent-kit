export function findSkill(catalog, skillId) {
  const skill = catalog.find((entry) => entry.id === skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  return skill;
}
export function validateCatalog(catalog) {
  const errors = [];
  for (const skill of catalog) {
    if (!/^[a-z0-9-]+$/.test(skill.id ?? "")) errors.push("Invalid skill id.");
    if (!/^[a-f0-9]{40}$/.test(skill.source?.ref ?? ""))
      errors.push(`${skill.id}: source ref must be a full immutable Git SHA.`);
    if (
      skill.source?.type === "git" &&
      skill.source?.repository !== "local://agent-skills" &&
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(
        skill.source?.repository ?? "",
      )
    )
      errors.push(`${skill.id}: Git source must use a canonical GitHub URL.`);
    if (!skill.license) errors.push(`${skill.id}: license is required.`);
    if (skill.source?.path?.split(/[\\/]/).includes(".."))
      errors.push(`${skill.id}: source path traversal is prohibited.`);
  }
  return errors;
}
export function resolvePreset(catalog, preset) {
  return preset.skills.map((id) => {
    const skill = findSkill(catalog.skills, id);
    if (!skill.security?.reviewed)
      throw new Error(
        `${id} is not reviewed and cannot be installed through a preset.`,
      );
    return skill;
  });
}
