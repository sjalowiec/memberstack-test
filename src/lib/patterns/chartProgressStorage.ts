/** localStorage keys and blobs for neckline/shoulder chart row progress. */

export type ChartProgressBlob = {
  checkedRowIds: string[];
  hideCompleted: boolean;
};

const STORAGE_NS = "kbm:chart-rows";

export function sanitizeChartProgressKeyPart(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^\w.-]/g, "_");
}

export function chartProgressStorageKey(patternId: string, chartId: string): string {
  return `${STORAGE_NS}:${sanitizeChartProgressKeyPart(patternId)}:${sanitizeChartProgressKeyPart(chartId)}`;
}

export function listChartProgressStorageEntries(
  patternId: string,
): { chartId: string; key: string }[] {
  const entries: { chartId: string; key: string }[] = [];
  if (typeof localStorage === "undefined") return entries;
  const prefix = `${STORAGE_NS}:${sanitizeChartProgressKeyPart(patternId)}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const chartId = key.slice(prefix.length);
      if (chartId) entries.push({ chartId, key });
    }
  } catch {
    /* ignore */
  }
  return entries;
}

export function readChartProgressBlob(key: string): ChartProgressBlob {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { checkedRowIds: [], hideCompleted: false };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        checkedRowIds: parsed.filter((x): x is string => typeof x === "string"),
        hideCompleted: false,
      };
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const row = parsed as Record<string, unknown>;
      const checked = Array.isArray(row.checkedRowIds)
        ? row.checkedRowIds.filter((x): x is string => typeof x === "string")
        : [];
      return {
        checkedRowIds: checked,
        hideCompleted: row.hideCompleted === true,
      };
    }
  } catch {
    /* ignore */
  }
  return { checkedRowIds: [], hideCompleted: false };
}

export function writeChartProgressBlob(key: string, blob: ChartProgressBlob): void {
  try {
    const payload = {
      checkedRowIds: [...blob.checkedRowIds].sort(),
      hideCompleted: !!blob.hideCompleted,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / blocked */
  }
}
