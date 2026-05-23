/**
 * Maps {@link resolveEffectiveSleevelessBodyShapeKind} to sleeveless garment diagram SVG paths.
 * Straight bodies use the base asset; A-line and shaped use `-aline` / `-shaped` suffixes.
 */

import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveDiagramFinishedHipInches } from "./customBuildEffectiveFinishedHip";
import {
  resolveEffectiveSleevelessBodyShapeKind,
  type SleevelessEffectiveBodyShapeKind,
} from "./sleevelessAlineShaping";

export type { SleevelessEffectiveBodyShapeKind };

function patternDataRecord(patternData: unknown): Record<string, unknown> {
  return patternData && typeof patternData === "object" && !Array.isArray(patternData)
    ? (patternData as Record<string, unknown>)
    : {};
}

/** Body shape for diagram routing (same bust/hip resolution as pattern generation). */
export function resolveSleevelessDiagramBodyShapeKind(
  patternData: unknown,
): SleevelessEffectiveBodyShapeKind {
  const pd = patternDataRecord(patternData);
  const finishedBust = resolveEffectiveFinishedBustInches(pd);
  const finishedHip = resolveDiagramFinishedHipInches(pd, finishedBust);
  return resolveEffectiveSleevelessBodyShapeKind(pd, finishedBust, finishedHip);
}

/** When true, schematic uses a dedicated body-shape SVG — no dotted side-guide overlay. */
export function usesDedicatedSleevelessBodyShapeDiagramSvg(
  kind: SleevelessEffectiveBodyShapeKind,
): boolean {
  return kind !== "straight";
}

/**
 * Applies `-aline` or `-shaped` before `.svg` on a straight-body diagram URL.
 * Returns `straightDiagramSrc` unchanged when kind is `straight`.
 */
export function applySleevelessDiagramBodyShapeSuffix(
  straightDiagramSrc: string,
  bodyShapeKind: SleevelessEffectiveBodyShapeKind,
): string {
  if (bodyShapeKind === "straight") return straightDiagramSrc;
  if (!straightDiagramSrc.endsWith(".svg")) return straightDiagramSrc;
  const suffix = bodyShapeKind === "aline" ? "-aline" : "-shaped";
  return `${straightDiagramSrc.slice(0, -4)}${suffix}.svg`;
}
