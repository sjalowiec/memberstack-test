/** Normalize CSV header names for consistent lookup and Postgres identifiers. */
export function normalizeHeaderName(header: string): string {
  return header.replace(/\uFEFF/g, "").replace(/\r/g, "").trim();
}

/** Map CSV header to Postgres column name (lowercase, preserve source spelling). */
export function headerToPgColumn(header: string): string {
  return normalizeHeaderName(header).toLowerCase();
}

export function buildHeaderIndex(headers: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const header of headers) {
    const normalized = normalizeHeaderName(header);
    index.set(normalized.toLowerCase(), normalized);
  }
  return index;
}

export function resolveSourceHeader(
  headerIndex: Map<string, string>,
  sourceName: string,
): string | undefined {
  return headerIndex.get(sourceName.toLowerCase());
}
