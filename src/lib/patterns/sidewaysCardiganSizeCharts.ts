/**
 * Sideways Cardigan starting-size charts: Misses 1–8 and plus (customer-facing
 * label: Women's) X–6X. The builder shows one chart at a time after the knitter
 * picks a chart button. The stored audience key remains `misses` | `plus`.
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
  { audience: "misses" as const, heading: "Misses", range: "1–8", buttonLabel: "Misses (1–8)" },
  { audience: "plus" as const, heading: "Women's", range: "X–6X", buttonLabel: "Women's (X–6X)" },
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

export function isSidewaysCardiganSizeInChart(
  size: unknown,
  audience: SidewaysCardiganWomenChartAudience,
): boolean {
  if (size === undefined || size === null || size === "") return false;
  return findSidewaysCardiganWomenChartRow(String(size), audience) != null;
}
