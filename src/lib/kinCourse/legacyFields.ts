export function numberedLegacyFields(
  fields: Record<string, string> | undefined,
  prefix: string,
): Array<{ index: number; value: string }> {
  if (!fields) return [];
  const pattern = new RegExp(`^${prefix}_(\\d+)$`, "i");
  return Object.entries(fields)
    .map(([key, raw]) => {
      const match = pattern.exec(key);
      const value = String(raw ?? "").trim();
      if (!match || !value) return null;
      return { index: Number(match[1]), value };
    })
    .filter((entry): entry is { index: number; value: string } => entry != null)
    .sort((a, b) => a.index - b.index);
}
