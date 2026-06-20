import { isPositiveNumericMeasurement } from "./patternBuilderValidation";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { loadExpressPersisted } from "./sleevelessExpressResume";

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

export type AvailableNeedlesResolved = {
  value: string;
  source: string;
};

export type AvailableNeedlesMirrorSnapshot = {
  source: string;
  resolved: string;
  canonicalMachine: unknown;
  patternBuilderMachine: unknown;
  patternBuilderYarnGaugeMachine: unknown;
  expressPersisted: unknown;
};

/** Read the first valid needle count from every persistence location used by saved-pattern edit. */
export function readAvailableNeedlesFromAllSources(): AvailableNeedlesResolved {
  const pattern = getCurrentPattern();
  const patternData = getPatternData();
  const persisted = loadExpressPersisted();
  const ygm = sectionRecord(patternData.yarnGaugeMachine);
  const pbMachine = sectionRecord(patternData.machine);
  const canonMachine = sectionRecord(pattern.machine);

  const candidates: Array<[unknown, string]> = [
    [persisted?.availableNeedles, "express-persisted"],
    [ygm.availableNeedles, "patternBuilderData.yarnGaugeMachine"],
    [pbMachine.availableNeedles, "patternBuilderData.machine"],
    [canonMachine.availableNeedles, "kbm_current_pattern.machine"],
  ];
  for (const [raw, source] of candidates) {
    const value = resolveAvailableNeedlesFromSources(raw);
    if (value) return { value, source };
  }
  return { value: "", source: "none" };
}

function snapshotAvailableNeedlesMirrors(): Omit<AvailableNeedlesMirrorSnapshot, "source" | "resolved"> {
  const pattern = getCurrentPattern();
  const patternData = getPatternData();
  const persisted = loadExpressPersisted();
  return {
    canonicalMachine: sectionRecord(pattern.machine).availableNeedles,
    patternBuilderMachine: sectionRecord(patternData.machine).availableNeedles,
    patternBuilderYarnGaugeMachine: sectionRecord(patternData.yarnGaugeMachine).availableNeedles,
    expressPersisted: persisted?.availableNeedles,
  };
}

/**
 * Mirror a saved needle count into every store validated by Edit Pattern / pattern generation.
 * Does not invent a default — only copies when at least one source already has a valid value.
 */
export function syncAvailableNeedlesMirrorsFromAllSources(): AvailableNeedlesMirrorSnapshot | null {
  const { value, source } = readAvailableNeedlesFromAllSources();
  if (!value) {
    return null;
  }

  const pattern = getCurrentPattern();
  const patternData = getPatternData();
  const ygm = sectionRecord(patternData.yarnGaugeMachine);
  const pbMachine = sectionRecord(patternData.machine);
  const canonMachine = sectionRecord(pattern.machine);

  saveCurrentPattern({ machine: { ...canonMachine, availableNeedles: value } });
  savePatternData("machine", { ...pbMachine, availableNeedles: value });
  savePatternData("yarnGaugeMachine", { ...ygm, availableNeedles: value });

  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          localStorage.setItem(
            SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
            JSON.stringify({ ...(parsed as Record<string, unknown>), availableNeedles: value }),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { source, resolved: value, ...snapshotAvailableNeedlesMirrors() };
}
