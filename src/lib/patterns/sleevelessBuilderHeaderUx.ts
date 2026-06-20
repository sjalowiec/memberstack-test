import { resolveCustomPatternDisplayName } from "./customPatternEditingUx";
import { EXPRESS_EDITING_FALLBACK_LABEL } from "./sleevelessExpressResume";
import {
  DROP_SHOULDER_CONSTRUCTION,
  readDropShoulderBuilderPageConstruction,
} from "./patternConstructionIdentity";

export const DROP_SHOULDER_BUILDER_FALLBACK_LABEL = "Drop Shoulder Sweater";

/**
 * Client-side header sync for the Express “Build/Create” page (`/patterns/sleeveless/builder`).
 * The page template has a hardcoded `<h1>`, so we overwrite it when a saved project is active.
 */
export function resolveSleevelessBuilderHeaderTitle(): string {
  const named = resolveCustomPatternDisplayName();
  if (named) return named;
  if (readDropShoulderBuilderPageConstruction() === DROP_SHOULDER_CONSTRUCTION) {
    return DROP_SHOULDER_BUILDER_FALLBACK_LABEL;
  }
  return EXPRESS_EDITING_FALLBACK_LABEL;
}

export function syncSleevelessBuilderHeaderTitle(): void {
  if (typeof document === "undefined") return;
  const h1 = document.querySelector<HTMLElement>(".sleeveless-express-page .pattern-title");
  if (!h1) return;
  h1.textContent = resolveSleevelessBuilderHeaderTitle();
}

