/** Apply KEY=value lines onto an env object. Existing values win. Returns key names only. */
export function applyEnvText(text: string, env: NodeJS.ProcessEnv): string[] {
  const applied: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (env[key]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
    applied.push(key);
  }
  return applied;
}

export function assertDryRunArgs(argv: string[]): void {
  const unexpected = argv.filter((arg) => arg !== "--dry-run");
  if (unexpected.length > 0) {
    throw new Error("This script is dry-run only. It does not write calendar events.");
  }
}
