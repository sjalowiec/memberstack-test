import { parseMemberstackUserIdFromKey } from "../../watson/inspectCustomPatternProjectKeys";
import {
  listBlobKeysUnderPrefix,
  PATTERN_INSPECTOR_PREFIX,
  type PatternInspectorBlobStore,
} from "../../watson/patternInspector";
import { classifySavedPatternForErrata } from "./classifySavedPatternErrata";
import type { PatternErrataRecord, SavedPatternErrataClassification } from "./types";

export type PatternErrataImpactStore = Pick<PatternInspectorBlobStore, "list" | "get">;

export type PatternErrataImpactRow = {
  blobKey: string;
  projectId: string;
  projectName: string;
  ownerId: string | null;
  createdAt: string | null;
  classification: Exclude<SavedPatternErrataClassification, "out_of_scope">;
  builder: string | null;
  audience: string | null;
  size: string | null;
  lengthInches: number | null;
  upperArmInches: number | null;
  matchedMeasurements: string[];
  reason: string;
};

export type PatternErrataImpactBucket = {
  patternCount: number;
  ownerCount: number;
  unknownOwnerCount: number;
};

export type PatternErrataImpactReport = {
  readOnly: true;
  scanned: number;
  outOfScope: number;
  oldDefault: PatternErrataImpactBucket;
  customized: PatternErrataImpactBucket;
  currentDefault: PatternErrataImpactBucket;
  uncertain: PatternErrataImpactBucket;
  /** Potentially affected means a saved measurement still matches a previous default. */
  potentiallyAffected: PatternErrataImpactBucket;
  rows: PatternErrataImpactRow[];
};

const READ_CONCURRENCY = 8;

function projectIdFromKey(key: string): string {
  const file = key.split("/").pop() ?? "";
  return file.endsWith(".json") ? file.slice(0, -".json".length) : file;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function bucket(rows: PatternErrataImpactRow[], classification: PatternErrataImpactRow["classification"]): PatternErrataImpactBucket {
  const matched = rows.filter((row) => row.classification === classification);
  const owners = new Set(matched.map((row) => row.ownerId).filter((id): id is string => Boolean(id)));
  return {
    patternCount: matched.length,
    ownerCount: owners.size,
    unknownOwnerCount: matched.filter((row) => !row.ownerId).length,
  };
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Read-only count of saved patterns for one correction.
 * Lists and reads blobs. Never writes a pattern or a blob.
 */
export async function scanPatternErrataImpact(
  errata: Pick<PatternErrataRecord, "affectedBuilders" | "matchRules">,
  store: PatternErrataImpactStore,
): Promise<PatternErrataImpactReport> {
  const keys = (await listBlobKeysUnderPrefix(store, PATTERN_INSPECTOR_PREFIX)).filter(
    (key) => key.endsWith(".json") && !key.endsWith("/index.json"),
  );

  const classified = await mapPool(keys, READ_CONCURRENCY, async (blobKey) => {
    const ownerId = parseMemberstackUserIdFromKey(blobKey);
    const projectId = projectIdFromKey(blobKey);
    let raw: string | null | undefined;
    try {
      raw = await store.get(blobKey, { type: "text" });
    } catch {
      return {
        blobKey,
        projectId,
        projectName: "",
        ownerId,
        createdAt: null,
        classification: "uncertain" as const,
        builder: null,
        audience: null,
        size: null,
        lengthInches: null,
        upperArmInches: null,
        matchedMeasurements: [],
        reason: "The saved pattern could not be read.",
      };
    }
    if (!raw) {
      return {
        blobKey,
        projectId,
        projectName: "",
        ownerId,
        createdAt: null,
        classification: "uncertain" as const,
        builder: null,
        audience: null,
        size: null,
        lengthInches: null,
        upperArmInches: null,
        matchedMeasurements: [],
        reason: "The saved pattern could not be read.",
      };
    }

    let project: unknown;
    try {
      project = JSON.parse(raw) as unknown;
    } catch {
      return {
        blobKey,
        projectId,
        projectName: "",
        ownerId,
        createdAt: null,
        classification: "uncertain" as const,
        builder: null,
        audience: null,
        size: null,
        lengthInches: null,
        upperArmInches: null,
        matchedMeasurements: [],
        reason: "The saved pattern could not be read.",
      };
    }

    const root =
      project && typeof project === "object" && !Array.isArray(project)
        ? (project as Record<string, unknown>)
        : null;
    const match = classifySavedPatternForErrata(project, errata);
    if (match.classification === "out_of_scope") return null;
    return {
      blobKey,
      projectId: text(root?.id) ?? projectId,
      projectName: text(root?.name) ?? "",
      ownerId,
      createdAt: text(root?.createdAt),
      classification: match.classification,
      builder: match.builder,
      audience: match.audience,
      size: match.size,
      lengthInches: match.lengthInches,
      upperArmInches: match.upperArmInches,
      matchedMeasurements: match.matchedMeasurements,
      reason: match.reason,
    };
  });

  const rows = classified.filter((row): row is PatternErrataImpactRow => row !== null);
  rows.sort((a, b) => a.classification.localeCompare(b.classification) || a.projectName.localeCompare(b.projectName));
  const oldDefault = bucket(rows, "old_default");

  return {
    readOnly: true,
    scanned: keys.length,
    outOfScope: keys.length - rows.length,
    oldDefault,
    customized: bucket(rows, "customized"),
    currentDefault: bucket(rows, "current_default"),
    uncertain: bucket(rows, "uncertain"),
    potentiallyAffected: oldDefault,
    rows,
  };
}
