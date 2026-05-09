import type { SleevelessPatternRecord } from "./patternStorage.ts";
import { coerceSleevelessPatternRecord } from "./patternStorage.ts";
import goldenFile from "./sleevelessGoldenBeta.json";

export type SleevelessGoldenBetaSnapshotFile = {
  exportedAt?: string;
  canonicalPattern: unknown;
  patternBuilderData: unknown;
};

const snapshot = goldenFile as SleevelessGoldenBetaSnapshotFile;

export function getSleevelessGoldenBetaCanonicalPattern(): SleevelessPatternRecord {
  const raw = snapshot.canonicalPattern;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("sleevelessGoldenBeta.json: missing or invalid canonicalPattern");
  }
  const coerced = coerceSleevelessPatternRecord(raw as Record<string, unknown>);
  if (!coerced) {
    throw new Error("sleevelessGoldenBeta.json: canonicalPattern is not a sleeveless pattern");
  }
  return coerced;
}

export function getSleevelessGoldenBetaPatternBuilderData(): Record<string, unknown> {
  const pb = snapshot.patternBuilderData;
  if (!pb || typeof pb !== "object" || Array.isArray(pb)) {
    return {};
  }
  return pb as Record<string, unknown>;
}
