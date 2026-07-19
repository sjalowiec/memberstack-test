/**
 * Watson Saved Pattern Inspector ù read-only lookup of cloud-saved projects
 * in Netlify Blobs store `custom-pattern-projects` under the shared family prefix.
 *
 * Uses only Blob list + get. Never set / update / delete.
 * Store name and prefix are fixed (not taken from user input).
 */

import { getStore } from "@netlify/blobs";

import { buildMemberstackCustomerProfileUrl } from "./customerIdentifier";
import {
  findMatchingProjectKeys,
  isUuid,
  matchOutcome,
  parseMemberstackUserIdFromKey,
} from "./inspectCustomPatternProjectKeys";
import type { CustomPatternProject } from "../patterns/customPatternProjectTypes";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
} from "../patterns/patternSystemId";

export const PATTERN_INSPECTOR_BLOB_STORE = "custom-pattern-projects";
export const PATTERN_INSPECTOR_FAMILY = "sleeveless";
export const PATTERN_INSPECTOR_PREFIX = `${PATTERN_INSPECTOR_FAMILY}/`;

export type PatternInspectorLabeledValue = {
  label: string;
  value: string;
};

export type PatternInspectorFound = {
  status: "one";
  projectId: string;
  store: string;
  prefix: string;
  blobKey: string;
  sizeBytes: number;
  memberstackUserId: string | null;
  memberstackProfileHref: string | null;
  summary: PatternInspectorLabeledValue[];
  settings: PatternInspectorLabeledValue[];
  customBuildOverrides: PatternInspectorLabeledValue[];
  notes: string | null;
  sanitizedSettingsText: string;
  rawJson: string;
  project: Record<string, unknown>;
};

export type PatternInspectorResult =
  | {
      status: "invalid";
      projectId: string;
      store: string;
      prefix: string;
      message: string;
    }
  | {
      status: "none";
      projectId: string;
      store: string;
      prefix: string;
      message: string;
    }
  | {
      status: "many";
      projectId: string;
      store: string;
      prefix: string;
      matchingKeys: string[];
      message: string;
    }
  | PatternInspectorFound
  | {
      status: "error";
      projectId: string;
      store: string;
      prefix: string;
      message: string;
    };

/** Minimal Blob surface used by the inspector (list + get only). */
export type PatternInspectorBlobStore = {
  list: (options: { prefix: string }) => Promise<unknown> | AsyncIterable<unknown>;
  get: (key: string, options: { type: "text" }) => Promise<string | null | undefined>;
};

export type PatternInspectorDeps = {
  getProjectsStore?: () => PatternInspectorBlobStore;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayScalar(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "";
}

function formatDateDisplay(value: unknown): string {
  const raw = displayScalar(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatGaugeDisplay(pattern: Record<string, unknown>): string {
  const yarnGauge = asRecord(pattern.yarnGauge);
  const rawSts = displayScalar(yarnGauge.gaugeStitchRaw);
  const rawRows = displayScalar(yarnGauge.gaugeRowRaw);
  const unit = yarnGauge.gaugeRawUnit === "cm" ? "cm" : "in";
  if (rawSts && rawRows) {
    return `${rawSts} sts / ${rawRows} rows per ${unit === "cm" ? "10 cm" : "4 in"}`;
  }
  const sts = displayScalar(yarnGauge.stitchGauge);
  const rows = displayScalar(yarnGauge.rowGauge);
  if (sts && rows) return `${sts} sts/in ù ${rows} rows/in`;
  return "";
}

function measurementFromFit(
  fit: Record<string, unknown>,
  measurements: Record<string, unknown>,
  key: string,
): string {
  const selected = asRecord(fit.selectedMeasurements);
  const fromSelected = displayScalar(selected[key]);
  if (fromSelected) return fromSelected;
  return displayScalar(measurements[key]);
}

function resolvePatternSystemLabel(project: Record<string, unknown>): string {
  const system = resolvePatternSystemFromProject({
    pattern: asRecord(project.pattern) as CustomPatternProject["pattern"],
    customOverrides: asRecord(project.customOverrides),
  });
  return patternSystemDisplayName(system);
}

function resolveBodyStyle(style: Record<string, unknown>): string {
  return (
    displayScalar(style.bodyShape) ||
    displayScalar(style.shape) ||
    displayScalar(style.bodyStyle) ||
    ""
  );
}

function resolveFit(fit: Record<string, unknown>): string {
  return displayScalar(fit.fitPreference) || displayScalar(fit.fit) || "";
}

function resolveSleeveLength(
  style: Record<string, unknown>,
  fit: Record<string, unknown>,
  measurements: Record<string, unknown>,
): string {
  return (
    displayScalar(style.sleeveLength) ||
    measurementFromFit(fit, measurements, "sleeve_length") ||
    measurementFromFit(fit, measurements, "sleeveLength") ||
    ""
  );
}

function resolveHemHip(
  fit: Record<string, unknown>,
  measurements: Record<string, unknown>,
): string {
  return (
    measurementFromFit(fit, measurements, "hip") ||
    measurementFromFit(fit, measurements, "finished_hip") ||
    measurementFromFit(fit, measurements, "finishedHip") ||
    measurementFromFit(fit, measurements, "hem_width") ||
    ""
  );
}

function pushRow(
  rows: PatternInspectorLabeledValue[],
  label: string,
  value: string,
): void {
  if (!value) return;
  rows.push({ label, value });
}

/** Build summary rows shown at the top of a found project. */
export function buildPatternInspectorSummary(input: {
  project: Record<string, unknown>;
  projectId: string;
  blobKey: string;
  sizeBytes: number;
  memberstackUserId: string | null;
}): PatternInspectorLabeledValue[] {
  const { project, projectId, blobKey, sizeBytes, memberstackUserId } = input;
  const pattern = asRecord(project.pattern);
  const style = asRecord(pattern.style);
  const fit = asRecord(pattern.fit);
  const measurements = asRecord(pattern.measurements);

  const rows: PatternInspectorLabeledValue[] = [];
  pushRow(rows, "Pattern name", displayScalar(project.name) || "(unnamed)");
  pushRow(rows, "Project ID", projectId);
  pushRow(rows, "Pattern system / construction", resolvePatternSystemLabel(project));
  pushRow(rows, "Created date", formatDateDisplay(project.createdAt));
  pushRow(rows, "Updated date", formatDateDisplay(project.updatedAt));
  pushRow(rows, "Memberstack user ID", memberstackUserId ?? "");
  pushRow(rows, "Blob key", blobKey);
  pushRow(rows, "Size", formatBytes(sizeBytes));
  pushRow(rows, "Gauge", formatGaugeDisplay(pattern));
  pushRow(rows, "Fit", resolveFit(fit));
  pushRow(rows, "Body style", resolveBodyStyle(style));
  pushRow(rows, "Neckline", displayScalar(style.neckline));
  pushRow(rows, "Sleeve length", resolveSleeveLength(style, fit, measurements));
  return rows;
}

/** Readable pattern settings / measurements rows. */
export function buildPatternInspectorSettings(
  project: Record<string, unknown>,
): PatternInspectorLabeledValue[] {
  const pattern = asRecord(project.pattern);
  const style = asRecord(pattern.style);
  const fit = asRecord(pattern.fit);
  const measurements = asRecord(pattern.measurements);

  const rows: PatternInspectorLabeledValue[] = [];
  pushRow(rows, "Selected size", displayScalar(fit.selectedSize));
  pushRow(rows, "Gauge", formatGaugeDisplay(pattern));
  pushRow(rows, "Fit", resolveFit(fit));
  pushRow(rows, "Body style", resolveBodyStyle(style));
  pushRow(rows, "Neckline", displayScalar(style.neckline));
  pushRow(rows, "Sleeve length", resolveSleeveLength(style, fit, measurements));
  pushRow(
    rows,
    "Neck width",
    measurementFromFit(fit, measurements, "neck_width") ||
      measurementFromFit(fit, measurements, "neckWidth") ||
      measurementFromFit(fit, measurements, "finishedNeckOpeningWidth"),
  );
  pushRow(
    rows,
    "Shoulder width",
    measurementFromFit(fit, measurements, "shoulder_width") ||
      measurementFromFit(fit, measurements, "shoulderWidth"),
  );
  pushRow(
    rows,
    "Bust / chest",
    measurementFromFit(fit, measurements, "finished_bust_chest") ||
      measurementFromFit(fit, measurements, "finishedBust") ||
      measurementFromFit(fit, measurements, "chestBust"),
  );
  pushRow(rows, "Hem / hip width", resolveHemHip(fit, measurements));
  pushRow(
    rows,
    "Armhole depth",
    measurementFromFit(fit, measurements, "armhole_depth") ||
      measurementFromFit(fit, measurements, "armholeDepth"),
  );
  pushRow(
    rows,
    "Front neck depth",
    measurementFromFit(fit, measurements, "front_neck_depth") ||
      measurementFromFit(fit, measurements, "frontNeckDepth") ||
      measurementFromFit(fit, measurements, "neckDepth"),
  );
  pushRow(
    rows,
    "Back neck depth",
    measurementFromFit(fit, measurements, "back_neck_depth") ||
      measurementFromFit(fit, measurements, "backNeckDepth"),
  );
  pushRow(rows, "Pattern mode", displayScalar(style.patternMode));
  pushRow(rows, "Source", displayScalar(project.source));
  pushRow(rows, "Family", displayScalar(project.family));
  pushRow(rows, "Audience / who", displayScalar(fit.who) || displayScalar(style.who));

  const selected = asRecord(fit.selectedMeasurements);
  for (const [key, value] of Object.entries(selected)) {
    const known = new Set([
      "neck_width",
      "shoulder_width",
      "finished_bust_chest",
      "hip",
      "finished_hip",
      "armhole_depth",
      "front_neck_depth",
      "back_neck_depth",
      "sleeve_length",
      "sleeveLength",
    ]);
    if (known.has(key)) continue;
    const text = displayScalar(value);
    if (text) pushRow(rows, `Measurement: ${key}`, text);
  }

  return rows;
}

/** Custom Build override rows from fit.cbMeasurementOverrides. */
export function buildCustomBuildOverrideRows(
  project: Record<string, unknown>,
): PatternInspectorLabeledValue[] {
  const fit = asRecord(asRecord(project.pattern).fit);
  const overrides = asRecord(fit.cbMeasurementOverrides);
  const rows: PatternInspectorLabeledValue[] = [];
  for (const [key, value] of Object.entries(overrides)) {
    const text = displayScalar(value);
    if (text) pushRow(rows, key, text);
  }
  const customOverrides = asRecord(project.customOverrides);
  for (const [key, value] of Object.entries(customOverrides)) {
    if (typeof value === "object" && value != null) {
      pushRow(rows, `customOverrides.${key}`, JSON.stringify(value));
    } else {
      const text = displayScalar(value);
      if (text) pushRow(rows, `customOverrides.${key}`, text);
    }
  }
  return rows;
}

export function extractProjectNotes(project: Record<string, unknown>): string | null {
  const top = displayScalar(project.notes);
  if (top) return top;
  const pattern = asRecord(project.pattern);
  const meta = asRecord(pattern.patternProject);
  const nested = displayScalar(meta.notes);
  return nested || null;
}

/** Compact text for clipboard ù settings only, no reading-workflow noise. */
export function buildSanitizedSettingsText(input: {
  projectId: string;
  blobKey: string;
  memberstackUserId: string | null;
  summary: PatternInspectorLabeledValue[];
  settings: PatternInspectorLabeledValue[];
  customBuildOverrides: PatternInspectorLabeledValue[];
  notes: string | null;
}): string {
  const lines: string[] = [
    "Saved Pattern Inspector ù sanitized settings",
    `Project ID: ${input.projectId}`,
    `Blob key: ${input.blobKey}`,
  ];
  if (input.memberstackUserId) {
    lines.push(`Memberstack user ID: ${input.memberstackUserId}`);
  }
  lines.push("");
  lines.push("Summary:");
  for (const row of input.summary) {
    lines.push(`- ${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push("Pattern settings:");
  for (const row of input.settings) {
    lines.push(`- ${row.label}: ${row.value}`);
  }
  if (input.customBuildOverrides.length > 0) {
    lines.push("");
    lines.push("Custom Build overrides:");
    for (const row of input.customBuildOverrides) {
      lines.push(`- ${row.label}: ${row.value}`);
    }
  }
  if (input.notes) {
    lines.push("");
    lines.push("Member pattern notes:");
    lines.push(input.notes);
  }
  return lines.join("\n");
}

export function formatProjectJsonForDisplay(project: unknown): string {
  try {
    return JSON.stringify(project, null, 2);
  } catch {
    return String(project);
  }
}

export function notFoundMessage(projectId: string): string {
  return [
    `No saved pattern was found for project ID "${projectId}".`,
    "",
    "This project may have been:",
    "- deleted",
    "- never cloud-saved",
    "- generated from a local working draft",
    "- created on another environment",
    "",
    `Searched store: ${PATTERN_INSPECTOR_BLOB_STORE}`,
    `Searched prefix: ${PATTERN_INSPECTOR_PREFIX}`,
  ].join("\n");
}

function defaultGetProjectsStore(): PatternInspectorBlobStore {
  return getStore({
    name: PATTERN_INSPECTOR_BLOB_STORE,
    consistency: "strong",
  }) as PatternInspectorBlobStore;
}

/**
 * List all blob keys under a prefix (handles both paged async iterables and single pages).
 */
export async function listBlobKeysUnderPrefix(
  store: PatternInspectorBlobStore,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  const listed = await store.list({ prefix });

  if (listed && typeof (listed as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    for await (const page of listed as AsyncIterable<{ blobs?: Array<{ key?: string }> }>) {
      for (const blob of page.blobs ?? []) {
        if (blob?.key) keys.push(blob.key);
      }
    }
    return keys;
  }

  const page = listed as { blobs?: Array<{ key?: string }> } | null;
  for (const blob of page?.blobs ?? []) {
    if (blob?.key) keys.push(blob.key);
  }
  return keys;
}

function buildFoundResult(input: {
  projectId: string;
  blobKey: string;
  rawText: string;
  project: Record<string, unknown>;
}): PatternInspectorFound {
  const memberstackUserId = parseMemberstackUserIdFromKey(input.blobKey);
  const sizeBytes = new TextEncoder().encode(input.rawText).length;
  const summary = buildPatternInspectorSummary({
    project: input.project,
    projectId: input.projectId,
    blobKey: input.blobKey,
    sizeBytes,
    memberstackUserId,
  });
  const settings = buildPatternInspectorSettings(input.project);
  const customBuildOverrides = buildCustomBuildOverrideRows(input.project);
  const notes = extractProjectNotes(input.project);
  const sanitizedSettingsText = buildSanitizedSettingsText({
    projectId: input.projectId,
    blobKey: input.blobKey,
    memberstackUserId,
    summary,
    settings,
    customBuildOverrides,
    notes,
  });

  return {
    status: "one",
    projectId: input.projectId,
    store: PATTERN_INSPECTOR_BLOB_STORE,
    prefix: PATTERN_INSPECTOR_PREFIX,
    blobKey: input.blobKey,
    sizeBytes,
    memberstackUserId,
    memberstackProfileHref: memberstackUserId
      ? buildMemberstackCustomerProfileUrl(memberstackUserId)
      : null,
    summary,
    settings,
    customBuildOverrides,
    notes,
    sanitizedSettingsText,
    rawJson: formatProjectJsonForDisplay(input.project),
    project: input.project,
  };
}

/**
 * Look up one saved pattern project by UUID under the fixed sleeveless/ family prefix.
 * Read-only: list + get only.
 */
export async function inspectSavedPatternByProjectId(
  rawProjectId: string,
  deps: PatternInspectorDeps = {},
): Promise<PatternInspectorResult> {
  const projectId = String(rawProjectId ?? "").trim();
  const storeName = PATTERN_INSPECTOR_BLOB_STORE;
  const prefix = PATTERN_INSPECTOR_PREFIX;

  if (!isUuid(projectId)) {
    return {
      status: "invalid",
      projectId,
      store: storeName,
      prefix,
      message: projectId
        ? `Invalid project ID: expected a UUID, got "${projectId}".`
        : "Enter a project ID (UUID) from a pattern URL or PDF.",
    };
  }

  try {
    const getProjectsStore = deps.getProjectsStore ?? defaultGetProjectsStore;
    const store = getProjectsStore();
    const keys = await listBlobKeysUnderPrefix(store, prefix);
    const matchingKeys = findMatchingProjectKeys(keys, projectId);
    const outcome = matchOutcome({ matchingKeys });

    if (outcome === "none") {
      return {
        status: "none",
        projectId,
        store: storeName,
        prefix,
        message: notFoundMessage(projectId),
      };
    }

    if (outcome === "many") {
      return {
        status: "many",
        projectId,
        store: storeName,
        prefix,
        matchingKeys,
        message: `Multiple blobs matched project ID "${projectId}". Refusing to guess ù review the matching keys below.`,
      };
    }

    const blobKey = matchingKeys[0];
    const rawText = await store.get(blobKey, { type: "text" });
    if (rawText == null || rawText === "") {
      return {
        status: "error",
        projectId,
        store: storeName,
        prefix,
        message: `Blob key matched the list but get returned empty: ${blobKey}`,
      };
    }

    let project: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          status: "error",
          projectId,
          store: storeName,
          prefix,
          message: `Blob at ${blobKey} is not a JSON object.`,
        };
      }
      project = parsed as Record<string, unknown>;
    } catch {
      return {
        status: "error",
        projectId,
        store: storeName,
        prefix,
        message: `Blob at ${blobKey} is not valid JSON.`,
      };
    }

    return buildFoundResult({ projectId, blobKey, rawText, project });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      projectId,
      store: storeName,
      prefix,
      message: `Could not read the pattern blob store: ${detail}`,
    };
  }
}
