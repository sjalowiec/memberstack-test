/**
 * Set-In Sleeve size charts offered for a new pattern.
 * Misses → `misses` (Express who `women`). Women's → `plus` (X through 6X).
 * Men's → `men`. Baby and Kids are not offered.
 * Sleeveless and Drop Shoulder keep their own pickers.
 */

import {
  readSetInSleeveBuilderPageConstruction,
  SET_IN_SLEEVE_CONSTRUCTION,
} from "./setInSleeveConstructionIdentity";

export const SET_IN_SLEEVE_WHO_OPTIONS = [
  { value: "women", label: "Misses" },
  { value: "plus", label: "Women's" },
  { value: "men", label: "Men's" },
] as const;

const ADULT_CHART_KEYS = ["misses", "plus", "men"] as const;

export function isSetInSleeveBuilderPage(): boolean {
  return readSetInSleeveBuilderPageConstruction() === SET_IN_SLEEVE_CONSTRUCTION;
}

/** Customer-facing name for a stored chart key. Empty when the key is not an adult Set-In chart. */
export function setInSleeveAdultChartLabel(audience: string): string {
  const key = String(audience ?? "").trim().toLowerCase();
  if (key === "misses") return "Misses";
  if (key === "plus") return "Women's";
  if (key === "men") return "Men's";
  return "";
}

/**
 * Auto-title prefix for Set-In Sleeve. The stored chart key wins, so a Misses
 * chart (`misses`, Express who `women`) is never labeled Women's.
 * Empty for Baby and Kids so those saved projects keep their existing names.
 */
export function setInSleeveAudiencePrefixLabel(who: unknown, chartAudience?: unknown): string {
  const fromChart = setInSleeveAdultChartLabel(String(chartAudience ?? ""));
  if (fromChart) return fromChart;
  const key = String(who ?? "").trim().toLowerCase();
  if (key === "plus") return "Women's";
  if (key === "men" || key === "man" || key === "male") return "Men's";
  if (key === "women" || key === "woman" || key === "misses") return "Misses";
  return "";
}

/** Who values offered for a new Set-In Sleeve pattern. */
export function setInSleeveWhoIsSupported(who: unknown): boolean {
  const key = String(who ?? "").trim().toLowerCase();
  if (key === "women" || key === "woman" || key === "misses") return true;
  if (key === "plus") return true;
  if (key === "men" || key === "man" || key === "male") return true;
  return false;
}

/**
 * Drop Baby or Kids on a new Set-In Sleeve session.
 * Saved projects keep their stored chart.
 */
export function omitUnsupportedSetInSleeveWho(
  values: Record<string, string>,
  options: { editingSavedProject: boolean },
): void {
  if (!isSetInSleeveBuilderPage()) return;
  if (options.editingSavedProject) return;
  const who = String(values.who ?? "").trim().toLowerCase();
  if (!who || setInSleeveWhoIsSupported(who)) return;
  delete values.who;
  delete values.selectedSize;
}

export function isSetInSleeveAdultChartKey(audience: string): boolean {
  return (ADULT_CHART_KEYS as readonly string[]).includes(String(audience ?? "").trim().toLowerCase());
}
