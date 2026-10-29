/**
 * Step 3 sponge-bar video choice.
 * An LK150 tab is selected only when that model is identified.
 * A brand, including Silver Reed, is not enough.
 */

export const SPONGE_TAB_METAL = "metal";
export const SPONGE_TAB_LK150 = "lk150";

export const LK150_MODEL_SLUG = "silver-reed-lk150";

const SPONGE_TABS = [SPONGE_TAB_METAL, SPONGE_TAB_LK150] as const;

export type SpongeVideoTab = (typeof SPONGE_TABS)[number];

const UNIDENTIFIED_MODEL_IDS = new Set(["", "unlisted", "unsure"]);

function normalizedModelLabel(modelLabel: string): string {
  return modelLabel.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** True only for a committed LK150 model, never for a brand alone. */
export function isSpecificLk150Model(modelId: string, modelLabel: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (UNIDENTIFIED_MODEL_IDS.has(id)) return false;
  if (id === LK150_MODEL_SLUG) return true;
  return normalizedModelLabel(modelLabel) === "lk150";
}

export function spongeVideoTabForModel(modelId: string, modelLabel: string): SpongeVideoTab {
  return isSpecificLk150Model(modelId, modelLabel) ? SPONGE_TAB_LK150 : SPONGE_TAB_METAL;
}

export function spongeTabFromKey(current: SpongeVideoTab, key: string): SpongeVideoTab | null {
  const index = SPONGE_TABS.indexOf(current);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return SPONGE_TABS[(index + 1) % SPONGE_TABS.length] ?? null;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return SPONGE_TABS[(index - 1 + SPONGE_TABS.length) % SPONGE_TABS.length] ?? null;
  }
  if (key === "Home") return SPONGE_TAB_METAL;
  if (key === "End") return SPONGE_TAB_LK150;
  return null;
}

/** Leaving a tab pauses that video. Staying on it does not. */
export function applySpongeTabChange(
  current: SpongeVideoTab,
  next: SpongeVideoTab,
): { tab: SpongeVideoTab; pauseTab: SpongeVideoTab | null } {
  if (current === next) return { tab: current, pauseTab: null };
  return { tab: next, pauseTab: current };
}

/** Vimeo postMessage pause. Does not change the embed URL or player id. */
export function pauseVimeoPlayerMessage(): string {
  return JSON.stringify({ method: "pause" });
}

export const PAUSE_VIMEO_PLAYER_ORIGIN = "https://player.vimeo.com";
