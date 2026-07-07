/**
 * Pattern system identifiers for entitlement, activity logging, and user-facing copy.
 *
 * Each pattern system gets its own one-time free saved pattern allowance for logged-in
 * non-members. Systems share blob `family: "sleeveless"` today but are distinguished by
 * construction metadata on saved projects and the working draft.
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { readHydratedConstructionBaseline } from "./customPatternProjectConstructionBaseline";
import {
  DROP_SHOULDER_CONSTRUCTION,
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  hasAuthoritativeDropShoulderConstruction,
  isActiveDropShoulderConstruction,
} from "./patternConstructionIdentity";
import type { SleevelessPatternRecord } from "./patternStorage";
import { getCurrentPattern } from "./patternStorage";

/** Canonical pattern system slugs used in entitlement tracking. */
export type PatternSystemId =
  | "sleeveless"
  | "drop-shoulder"
  | "blanket"
  | "hat"
  | "raglan";

export const PATTERN_SYSTEM_IDS: readonly PatternSystemId[] = [
  "sleeveless",
  "drop-shoulder",
  "blanket",
  "hat",
  "raglan",
];

/** User-facing pattern system names for copy and toasts. */
export const PATTERN_SYSTEM_DISPLAY_NAMES: Record<PatternSystemId, string> = {
  sleeveless: "Sleeveless",
  "drop-shoulder": "Drop Shoulder",
  blanket: "Blanket",
  hat: "Hat",
  raglan: "Raglan",
};

export function patternSystemDisplayName(systemId: PatternSystemId): string {
  return PATTERN_SYSTEM_DISPLAY_NAMES[systemId] ?? systemId;
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

/** Resolve pattern system from saved project metadata. */
export function resolvePatternSystemFromProject(
  project: Pick<CustomPatternProject, "pattern" | "customOverrides">,
): PatternSystemId {
  if (
    hasAuthoritativeDropShoulderConstruction(
      section(project.pattern?.style),
      section(project.customOverrides),
    )
  ) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

/** Resolve pattern system from a pattern record + optional overrides. */
export function resolvePatternSystemFromPatternRecord(
  pattern: SleevelessPatternRecord,
  customOverrides?: Record<string, unknown>,
): PatternSystemId {
  if (hasAuthoritativeDropShoulderConstruction(section(pattern.style), customOverrides)) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

function readPagePathname(scope?: Document): string {
  if (typeof window !== "undefined") {
    const fromWindow = window.location?.pathname?.trim();
    if (fromWindow) return fromWindow;
  }
  const fromDoc =
    scope && "defaultView" in scope ? scope.defaultView?.location?.pathname?.trim() : "";
  return fromDoc ?? "";
}

/**
 * URL + DOM markers for builder / new-pattern intent (no working-draft fallback).
 * Returns null when the page does not express a pattern system explicitly.
 */
function resolvePatternSystemFromPageUrlAndDom(doc?: Document): PatternSystemId | null {
  if (typeof document === "undefined" && !doc) return null;
  const scope = doc ?? document;
  const pathname = readPagePathname(scope);
  if (/\/patterns\/drop-shoulder(?:\/|$)/.test(pathname)) {
    return "drop-shoulder";
  }
  // Builder entry routes: URL intent wins over a stale cross-system working draft in localStorage.
  // (A nosub knitter with a saved Drop Shoulder pattern must still open Sleeveless with ?new=1.)
  if (/\/patterns\/sleeveless-express(?:\/|$)/.test(pathname)) {
    return "sleeveless";
  }
  if (/\/patterns\/sleeveless\/builder(?:\/|$)/.test(pathname)) {
    return "sleeveless";
  }
  if (scope && typeof scope.querySelector === "function") {
    const expressConstruction = scope
      .querySelector<HTMLElement>("[data-express-construction]")
      ?.getAttribute("data-express-construction")
      ?.trim();
    if (expressConstruction === DROP_SHOULDER_CONSTRUCTION) {
      return "drop-shoulder";
    }
  }
  return null;
}

/**
 * Pattern system for new-pattern / builder entitlement gates - page intent only.
 * Never falls back to a stale working draft or active saved-project session.
 */
export function resolvePatternSystemForBuilderGate(doc?: Document): PatternSystemId {
  return resolvePatternSystemFromPageUrlAndDom(doc) ?? "sleeveless";
}

/** @alias {@link resolvePatternSystemForBuilderGate} */
export function resolvePatternSystemForNewPatternGate(doc?: Document): PatternSystemId {
  return resolvePatternSystemForBuilderGate(doc);
}

/** Resolve pattern system from the active browser page (pathname + draft markers). */
export function resolvePatternSystemFromPage(doc?: Document): PatternSystemId {
  const fromUrl = resolvePatternSystemFromPageUrlAndDom(doc);
  if (fromUrl) return fromUrl;
  if (isActiveDropShoulderConstruction()) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

/**
 * Resolve pattern system from the active saved-project session (baseline + working draft).
 * Prefer this over {@link resolvePatternSystemFromPage} when a saved project is linked.
 */
export function resolvePatternSystemFromWorkingSession(): PatternSystemId {
  const activeId = readActiveCustomPatternProjectId()?.trim();
  if (activeId) {
    const baseline = readHydratedConstructionBaseline();
    if (baseline?.projectId === activeId && baseline.hadAuthoritativeDropShoulder) {
      return "drop-shoulder";
    }
    try {
      const fromDraft = resolvePatternSystemFromPatternRecord(getCurrentPattern());
      if (fromDraft === "drop-shoulder") return "drop-shoulder";
    } catch {
      /* ignore */
    }
    if (baseline?.projectId === activeId) {
      return "sleeveless";
    }
  }
  if (isActiveDropShoulderConstruction()) {
    return "drop-shoulder";
  }
  return resolvePatternSystemFromPage();
}

/** Entitlement checks: saved project session when linked, otherwise builder page intent. */
export function resolvePatternSystemForEntitlement(doc?: Document): PatternSystemId {
  if (readActiveCustomPatternProjectId()?.trim()) {
    return resolvePatternSystemFromWorkingSession();
  }
  return resolvePatternSystemForBuilderGate(doc);
}

/** @internal Test seam - classify from raw style/customOverrides without draft reads. */
export function resolvePatternSystemFromStylePayload(
  style: Record<string, unknown> | undefined,
  customOverrides?: Record<string, unknown>,
): PatternSystemId {
  if (hasAuthoritativeDropShoulderConstruction(style, customOverrides)) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

export {
  DROP_SHOULDER_CONSTRUCTION,
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
};
