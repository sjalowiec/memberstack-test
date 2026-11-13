/**
 * Local Triangle Scarf draft. Reopens the last pattern in this browser.
 * Saved My Patterns projects hydrate this same draft; they do not use a second store.
 */

import type { SleevelessPatternProjectMeta } from "../sleevelessPatternProjectMeta";
import type { TriangleUnit } from "../triangleScarfMath";

export const TRIANGLE_SCARF_DRAFT_STORAGE_KEY = "kbm_triangle_scarf_draft";
export const TRIANGLE_SCARF_DRAFT_VERSION = 1 as const;

export type TriangleScarfDraft = {
  version: typeof TRIANGLE_SCARF_DRAFT_VERSION;
  patternType: "triangle-scarf";
  patternSystem: "triangle-scarf";
  length: string;
  depth: string;
  stitchGauge: string;
  rowGauge: string;
  needles: string;
  unit: TriangleUnit;
  /**
   * Saved/custom pattern name + project notes — same `patternProject` shape as
   * Hat and sweater saved projects. Absent on an unsaved temporary scarf.
   */
  patternProject?: SleevelessPatternProjectMeta;
  updatedAt: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizePatternProject(raw: unknown): SleevelessPatternProjectMeta | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const notes = typeof o.notes === "string" ? o.notes : "";
  const titleCustomized = o.titleCustomized === true;
  if (!title && !notes && !titleCustomized) return undefined;
  return { title, notes, ...(titleCustomized ? { titleCustomized: true } : {}) };
}

export function normalizeTriangleScarfDraft(raw: unknown): TriangleScarfDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.patternType != null && o.patternType !== "triangle-scarf") return null;
  if (o.patternSystem != null && o.patternSystem !== "triangle-scarf") return null;
  const unit: TriangleUnit = o.unit === "cm" ? "cm" : "in";
  const patternProject = normalizePatternProject(o.patternProject);
  return {
    version: TRIANGLE_SCARF_DRAFT_VERSION,
    patternType: "triangle-scarf",
    patternSystem: "triangle-scarf",
    length: text(o.length),
    depth: text(o.depth),
    stitchGauge: text(o.stitchGauge),
    rowGauge: text(o.rowGauge),
    needles: text(o.needles),
    unit,
    ...(patternProject ? { patternProject } : {}),
    updatedAt: text(o.updatedAt) || new Date().toISOString(),
  };
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readTriangleScarfDraft(store: Storage | null = browserStorage()): TriangleScarfDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(TRIANGLE_SCARF_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeTriangleScarfDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeTriangleScarfDraft(
  draft: TriangleScarfDraft,
  store: Storage | null = browserStorage(),
): void {
  if (!store) return;
  const next = normalizeTriangleScarfDraft({ ...draft, updatedAt: new Date().toISOString() });
  if (!next) return;
  store.setItem(TRIANGLE_SCARF_DRAFT_STORAGE_KEY, JSON.stringify(next));
}

export function clearTriangleScarfDraft(store: Storage | null = browserStorage()): void {
  store?.removeItem(TRIANGLE_SCARF_DRAFT_STORAGE_KEY);
}

export function createTriangleScarfDraft(
  partial?: Partial<TriangleScarfDraft>,
): TriangleScarfDraft {
  return {
    version: TRIANGLE_SCARF_DRAFT_VERSION,
    length: "",
    depth: "",
    stitchGauge: "",
    rowGauge: "",
    needles: "",
    unit: "in",
    updatedAt: new Date().toISOString(),
    ...partial,
    patternType: "triangle-scarf",
    patternSystem: "triangle-scarf",
  };
}
