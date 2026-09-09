/**
 * Women's size list for the Sideways Cardigan builder only:
 * Misses 1–8 followed by the plus chart (customer-facing label: Women's), sizes X–6X.
 *
 * Drop Shoulder and Sleeveless Express still map Women → misses only via
 * {@link expressWhoToChartAudience}. This helper must not be wired into those builders.
 */

import {
  getExpressChartRowsForAudience,
  normalizeChartRowSize,
  type ChartRow,
} from "./sleevelessExpressSizeChartClient";

export type SidewaysCardiganWomenChartAudience = "misses" | "plus";

export type SidewaysCardiganWomenChartRow = ChartRow & {
  chartAudience: SidewaysCardiganWomenChartAudience;
};

export const SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS = [
  { audience: "misses" as const, heading: "Misses" },
  { audience: "plus" as const, heading: "Women's" },
] as const;

/** Customer-facing chart name. The stored audience key remains `misses` | `plus`. */
export function sidewaysCardiganChartAudienceDisplayLabel(
  audience: SidewaysCardiganWomenChartAudience | "" | null | undefined,
): string {
  if (audience === "misses") return "Misses";
  if (audience === "plus") return "Women's";
  return "";
}

export function buildSidewaysCardiganWomenChartRows(): SidewaysCardiganWomenChartRow[] {
  const out: SidewaysCardiganWomenChartRow[] = [];
  for (const group of SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS) {
    out.push(...getSidewaysCardiganChartRowsForAudience(group.audience));
  }
  return out;
}

export function getSidewaysCardiganChartRowsForAudience(
  audience: SidewaysCardiganWomenChartAudience,
): SidewaysCardiganWomenChartRow[] {
  const out: SidewaysCardiganWomenChartRow[] = [];
  for (const row of getExpressChartRowsForAudience(audience)) {
    const size = normalizeChartRowSize(row);
    if (!size) continue;
    out.push({ ...row, chartAudience: audience });
  }
  return out;
}

export function findSidewaysCardiganWomenChartRow(
  sizeStr: string,
  audience?: SidewaysCardiganWomenChartAudience,
): SidewaysCardiganWomenChartRow | null {
  const key = String(sizeStr ?? "").trim();
  if (!key) return null;
  const rows = audience
    ? getSidewaysCardiganChartRowsForAudience(audience)
    : buildSidewaysCardiganWomenChartRows();
  return rows.find((row) => normalizeChartRowSize(row) === key) ?? null;
}

export function resolveSidewaysCardiganChartAudienceFromSize(
  sizeStr: string,
): SidewaysCardiganWomenChartAudience | null {
  return findSidewaysCardiganWomenChartRow(sizeStr)?.chartAudience ?? null;
}

export function isSidewaysCardiganWomenSize(size: unknown): boolean {
  if (size === undefined || size === null || size === "") return false;
  return findSidewaysCardiganWomenChartRow(String(size)) != null;
}
