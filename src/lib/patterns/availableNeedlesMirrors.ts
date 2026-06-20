import { isPositiveNumericMeasurement } from "./patternBuilderValidation";

function sectionRecord(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? { ...(obj as Record<string, unknown>) } : {};
}

/**
 * First positive needle count from the given sources (builder mirror, canonical machine, etc.).
 */
export function resolveAvailableNeedlesFromSources(...sources: unknown[]): string {
  for (const raw of sources) {
    if (!isPositiveNumericMeasurement(raw)) continue;
    if (typeof raw === "number") return String(raw);
    const s = String(raw).trim();
    const m = s.match(/\d+(?:\.\d+)?/);
    if (m) return m[0];
  }
  return "";
}

/** Available needles from `patternBuilderData` (`yarnGaugeMachine` then `machine`). */
export function patternBuilderAvailableNeedlesRaw(patternData: Record<string, unknown>): unknown {
  const ygm = sectionRecord(patternData.yarnGaugeMachine);
  const machine = sectionRecord(patternData.machine);
  return ygm.availableNeedles ?? machine.availableNeedles;
}
