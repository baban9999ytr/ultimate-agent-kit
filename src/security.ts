const patterns = [/(curl|wget)[^\n|]*\|\s*(sh|bash)/i, /rm\s+-rf\s+(\/|~)/i, /(?:API[_-]?KEY|SECRET|TOKEN)\s*=\s*[^\s]+/i, /ignore\s+(all\s+)?previous\s+instructions/i];

export function scanSkillText(content: string): string[] {
    return patterns.filter((pattern) => pattern.test(content)).map((pattern) => `Advisory match: ${pattern}`);
}
