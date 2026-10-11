/**
 * Set-In Sleeve size charts. Stored keys stay the shared sweater chart keys:
 * Misses → `misses` (Express who `women`), Women's → `plus`, Men's → `men`.
 * Baby and Kids are not offered in this builder. Sleeveless and Drop Shoulder
 * keep the shared Women / Men / Kids / Baby picker.
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

/** Who values that select Misses, Women's, or Men's. Kids and Baby are not included. */
export function setInSleeveWhoIsSupported(who: unknown): boolean {
  const key = String(who ?? "").trim().toLowerCase();
  if (key === "women" || key === "woman" || key === "misses") return true;
  if (key === "plus") return true;
  if (key === "men" || key === "man" || key === "male") return true;
  return false;
}

/**
 * Drop a Baby or Kids selection on a new Set-In Sleeve session.
 * Saved projects keep their stored chart so existing patterns are left intact.
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
