function sectionValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when merging `patch` into `current` would change any patched key. */
export function sectionPatchWouldChange(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const [key, val] of Object.entries(patch)) {
    if (!sectionValuesEqual(current[key], val)) return true;
  }
  return false;
}

export function overrideRecordsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key, index) => key === keysB[index] && a[key] === b[key]);
}
