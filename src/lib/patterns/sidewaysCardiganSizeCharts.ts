/**
 * Sideways starting-size charts. The builder shows one chart at a time after the
 * knitter picks a chart button. Stored audience keys stay the shared sweater keys:
 * `misses` | `plus` | `men` | `kids` | `baby`.
 *
 * Drop Shoulder and Sleeveless Express still map Women → misses only via
 * {@link expressWhoToChartAudience}. This helper must not be wired into those builders.
 */

import {
  getExpressChartRowsForAudience,
  normalizeChartRowSize,
  type ChartRow,
} from "./sleevelessExpressSizeChartClient";

export const SIDEWAYS_CARDIGAN_CHART_AUDIENCES = ["misses", "plus", "men", "kids", "baby"] as const;

export type SidewaysCardiganChartAudience = (typeof SIDEWAYS_CARDIGAN_CHART_AUDIENCES)[number];

/** Previous name. Now every Sideways chart audience, including saved Misses and Women's keys. */
export type SidewaysCardiganWomenChartAudience = SidewaysCardiganChartAudience;

export type SidewaysCardiganChartRow = ChartRow & {
  chartAudience: SidewaysCardiganChartAudience;
};

/** Previous name. Chart rows still carry `chartAudience`. */
export type SidewaysCardiganWomenChartRow = SidewaysCardiganChartRow;

export const SIDEWAYS_CARDIGAN_CHART_GROUPS = [
  { audience: "misses" as const, heading: "Misses", range: "1–8", buttonLabel: "Misses (1–8)" },
  { audience: "plus" as const, heading: "Women's", range: "X–6X", buttonLabel: "Women's (X–6X)" },
  { audience: "men" as const, heading: "Men's", range: "Sm–5X", buttonLabel: "Men's (Sm–5X)" },
  { audience: "kids" as const, heading: "Kids'", range: "2–16 yr", buttonLabel: "Kids' (2–16 yr)" },
  { audience: "baby" as const, heading: "Baby", range: "3–24 mo", buttonLabel: "Baby (3–24 mo)" },
] as const;

/** Previous name. The list now includes Men's, Kids', and Baby as well as Misses and Women's. */
export const SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS = SIDEWAYS_CARDIGAN_CHART_GROUPS;

export function parseSidewaysCardiganChartAudience(
  value: unknown,
): SidewaysCardiganChartAudience | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return (SIDEWAYS_CARDIGAN_CHART_AUDIENCES as readonly string[]).includes(raw)
    ? (raw as SidewaysCardiganChartAudience)
    : null;
}

export function isSidewaysCardiganChartAudience(
  value: unknown,
): value is SidewaysCardiganChartAudience {
  return parseSidewaysCardiganChartAudience(value) != null;
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

/** Stored `recipientCategory` / `sizingChart` on a Sideways draft. Empty when unrecognized. */
export function sidewaysCardiganChartAudienceFromPattern(
  pattern: Record<string, unknown> | null | undefined,
): SidewaysCardiganChartAudience | "" {
  if (!pattern) return "";
  return (
    parseSidewaysCardiganChartAudience(
      section(pattern.style).recipientCategory ?? section(pattern.fit).sizingChart,
    ) ?? ""
  );
}

/** Customer-facing chart name. The stored audience key is unchanged. */
export function sidewaysCardiganChartAudienceDisplayLabel(
  audience: SidewaysCardiganChartAudience | "" | null | undefined,
): string {
  return SIDEWAYS_CARDIGAN_CHART_GROUPS.find((group) => group.audience === audience)?.heading ?? "";
}

export function buildSidewaysCardiganChartRows(): SidewaysCardiganChartRow[] {
  const out: SidewaysCardiganChartRow[] = [];
  for (const group of SIDEWAYS_CARDIGAN_CHART_GROUPS) {
    out.push(...getSidewaysCardiganChartRowsForAudience(group.audience));
  }
  return out;
}

/** Previous name. Returns every Sideways chart that is currently loaded. */
export const buildSidewaysCardiganWomenChartRows = buildSidewaysCardiganChartRows;

export function getSidewaysCardiganChartRowsForAudience(
  audience: SidewaysCardiganChartAudience,
): SidewaysCardiganChartRow[] {
  const out: SidewaysCardiganChartRow[] = [];
  for (const row of getExpressChartRowsForAudience(audience)) {
    const size = normalizeChartRowSize(row);
    if (!size) continue;
    out.push({ ...row, chartAudience: audience });
  }
  return out;
}

export function findSidewaysCardiganChartRow(
  sizeStr: string,
  audience?: SidewaysCardiganChartAudience,
): SidewaysCardiganChartRow | null {
  const key = String(sizeStr ?? "").trim();
  if (!key) return null;
  const rows = audience
    ? getSidewaysCardiganChartRowsForAudience(audience)
    : buildSidewaysCardiganChartRows();
  return rows.find((row) => normalizeChartRowSize(row) === key) ?? null;
}

/** Previous name. Looks up a size in one chart or across every Sideways chart. */
export const findSidewaysCardiganWomenChartRow = findSidewaysCardiganChartRow;

export function resolveSidewaysCardiganChartAudienceFromSize(
  sizeStr: string,
): SidewaysCardiganChartAudience | null {
  return findSidewaysCardiganChartRow(sizeStr)?.chartAudience ?? null;
}

export function isSidewaysCardiganChartSize(size: unknown): boolean {
  if (size === undefined || size === null || size === "") return false;
  return findSidewaysCardiganChartRow(String(size)) != null;
}

/** Previous name. True when the size exists in any loaded Sideways chart. */
export const isSidewaysCardiganWomenSize = isSidewaysCardiganChartSize;

export function isSidewaysCardiganSizeInChart(
  size: unknown,
  audience: SidewaysCardiganChartAudience,
): boolean {
  if (size === undefined || size === null || size === "") return false;
  return findSidewaysCardiganChartRow(String(size), audience) != null;
}
