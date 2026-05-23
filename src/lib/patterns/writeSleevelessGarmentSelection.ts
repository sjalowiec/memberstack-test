/**
 * Shared pullover/cardigan persistence for Express wizard and Custom Build style step.
 * Writes `garmentType` localStorage; pattern/canonical updates are done by page-specific sync helpers.
 */
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";

export type SleevelessGarmentType = "pullover" | "cardigan";

export function garmentTypeFromFront(front: string): SleevelessGarmentType {
  return front.trim().toLowerCase() === "open" ? "cardigan" : "pullover";
}

export function frontFromGarmentType(garmentType: string): "open" | "closed" {
  return garmentType === "cardigan" ? "open" : "closed";
}

/** `localStorage.garmentType` — read by Custom Build sync and diagram merge. */
export function writeSleevelessGarmentTypeLocalStorage(garmentType: SleevelessGarmentType): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, garmentType);
  } catch {
    /* quota */
  }
}
