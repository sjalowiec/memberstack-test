/**
 * Client API for saved Custom Pattern projects (Netlify Functions + Blobs).
 *
 * **Draft vs saved:** `localStorage` key `kbm_current_pattern` is the working draft for the current
 * browser session. Blob storage holds named saved projects; loading a project copies it into the draft.
 */
import {
  draftHasUnsavedDropShoulderConstructionDrift,
  writeHydratedConstructionBaseline,
} from "./customPatternProjectConstructionBaseline";
import { readActiveCustomPatternProjectId, readActiveCustomPatternProjectLinkedName } from "./customPatternProjectActiveId";
import {
  hasAuthoritativeDropShoulderConstruction,
  isActiveDropShoulderConstruction,
  isCorruptedSleevelessConstruction,
  preparePatternRecordForSave,
  sanitizeSavedProjectForHydration,
  withDropShoulderConstructionFamily,
} from "./patternConstructionIdentity";
import {
  getCurrentPattern,
  getPatternData,
  replaceWorkingDraftFromSavedPattern,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { mergedPatternForDisplayFromSources } from "./sleevelessPatternBuilderMerge";
import {
  flushCustomBuildMeasurementOverridesToCanonical,
  loadMeasurementOverrides,
  resolveCustomBuildSaveMeasureFlushRoot,
} from "./sleevelessCustomMeasurementStorage";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import type {
  CustomPatternFamily,
  CustomPatternProject,
  CustomPatternProjectSource,
  CustomPatternProjectSummary,
  PatternReadingWorkflowState,
  SaveCustomPatternProjectRequest,
  UpdateCustomPatternProjectRequest,
} from "./customPatternProjectTypes";
import { applySleevelessReadingWorkflow } from "./patternReadingWorkflow";
import {
  authHeadersForCustomPatternProjects,
  resolveCustomPatternProjectAuth,
  type CustomPatternProjectAuthMode,
} from "./customPatternProjectAuth";
import { perfEnd, perfStart } from "./savedPatternsPerfLog";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import {
  freeClaimedPatternIdForSystem,
  isFreeClaimedForSystem,
} from "./patternSystemFreeClaim";
import {
  resolvePatternSystemFromPage,
  resolvePatternSystemFromProject,
  type PatternSystemId,
} from "./patternSystemId";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

const FN_BASE = "/.netlify/functions";

export type PatternSaveEntitlementSnapshot = {
  patternSystem: PatternSystemId;
  hasSystemAccess: boolean;
  freeClaimedForSystem: boolean;
  freeClaimedPatternId?: string;
};

/** Build entitlement payload for create/delete requests. */
export async function buildPatternSaveEntitlementSnapshot(
  patternSystem?: PatternSystemId,
): Promise<PatternSaveEntitlementSnapshot> {
  const access = await resolveSleevelessUserAccessSnapshot();
  const systemId = patternSystem ?? resolvePatternSystemFromPage();
  return buildPatternSaveEntitlementSnapshotFromAccess(access, systemId);
}

export function buildPatternSaveEntitlementSnapshotFromAccess(
  access: SleevelessUserAccess,
  patternSystem: PatternSystemId,
): PatternSaveEntitlementSnapshot {
  const claimed = isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem);
  const claimedId = freeClaimedPatternIdForSystem(access.freeClaimsBySystem, patternSystem);
  return {
    patternSystem,
    hasSystemAccess: access.hasSystemAccess === true,
    freeClaimedForSystem: claimed,
    ...(claimedId ? { freeClaimedPatternId: claimedId } : {}),
  };
}

export function resolvePatternSystemForSavePayload(
  payload: Pick<SaveCustomPatternProjectRequest, "pattern" | "customOverrides">,
): PatternSystemId {
  return resolvePatternSystemFromProject({
    pattern: payload.pattern,
    customOverrides: payload.customOverrides ?? {},
  });
}

type ApiOk<T> = { ok: true; authMode?: CustomPatternProjectAuthMode } & T;
type ApiErr = { ok: false; error: string };

async function projectFetch<T>(
  path: string,
  init: RequestInit,
): Promise<(ApiOk<T> & T) | ApiErr> {
  const requestStart = perfStart();
  const auth = await resolveCustomPatternProjectAuth();
  const headers = {
    "Content-Type": "application/json",
    ...authHeadersForCustomPatternProjects(auth),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (auth.mode === "none") {
    perfEnd(`3-saved-patterns-request ${path} (auth blocked)`, requestStart, { authMode: auth.mode });
    return {
      ok: false,
      error: "Sign in to save Custom Pattern projects.",
    };
  }

  const fetchStart = perfStart();
  const res = await fetch(`${FN_BASE}/${path}`, { ...init, headers });
  perfEnd(`3-saved-patterns-fetch ${path}`, fetchStart, {
    status: res.status,
    authMode: auth.mode,
  });

  let data: unknown;
  const parseStart = perfStart();
  try {
    data = await res.json();
  } catch {
    perfEnd(`4-response-json-parse ${path} (failed)`, parseStart, { status: res.status });
    perfEnd(`3-saved-patterns-request ${path} total`, requestStart, { ok: false });
    return { ok: false, error: `Request failed (${res.status}).` };
  }
  perfEnd(`4-response-json-parse ${path}`, parseStart, {
    status: res.status,
    bodyType: data === null ? "null" : typeof data,
  });

  if (!data || typeof data !== "object") {
    perfEnd(`3-saved-patterns-request ${path} total`, requestStart, { ok: false });
    return { ok: false, error: `Request failed (${res.status}).` };
  }
  const body = data as Record<string, unknown>;
  if (!body.ok) {
    perfEnd(`3-saved-patterns-request ${path} total`, requestStart, { ok: false });
    return { ok: false, error: typeof body.error === "string" ? body.error : "Request failed." };
  }
  perfEnd(`3-saved-patterns-request ${path} total`, requestStart, { ok: true, authMode: auth.mode });
  return body as ApiOk<T> & T;
}

export function inferCustomPatternProjectSource(
  pattern: SleevelessPatternRecord,
): CustomPatternProjectSource {
  const mode = pattern.style?.patternMode;
  return mode === "express" ? "express" : "custom-build";
}

/** Build save payload from the current localStorage draft (`kbm_current_pattern`). */
export function buildSavePayloadFromWorkingDraft(
  name?: string,
  options: Partial<{
    family: CustomPatternFamily;
    source: CustomPatternProjectSource;
    customOverrides: Record<string, unknown>;
    /** Diagram inputs to merge before read; defaults to `document` in the browser. */
    flushRoot?: ParentNode | null;
    /** @internal Tests only — skip flushing measurement overrides into the draft. */
    skipFlushMeasurementOverrides?: boolean;
    /**
     * Run {@link syncCustomBuildToPatternStorage} before reading overrides (default false).
     * Sync reconciles straight-torso hip overrides and must not run during cloud save payload build.
     */
    syncToPatternStorage?: boolean;
  }> = {},
): SaveCustomPatternProjectRequest {
  const flushRoot = resolveCustomBuildSaveMeasureFlushRoot(
    options.flushRoot !== undefined
      ? options.flushRoot
      : typeof document !== "undefined"
        ? document
        : undefined,
  );

  if (!options.skipFlushMeasurementOverrides) {
    if (options.syncToPatternStorage === true) {
      syncCustomBuildToPatternStorage({ awaitCharts: false });
    }
    flushCustomBuildMeasurementOverridesToCanonical({ root: flushRoot ?? undefined });
  }

  let pattern = mergeWorkingDraftForCustomPatternSave(getCurrentPattern());
  const meta = getPatternProjectMeta(pattern);
  const resolvedName = (name ?? meta.title).trim() || "Untitled pattern";
  const measurementOverrides = loadMeasurementOverrides();
  const fitBase = patternSectionRecord(pattern.fit);
  const { cbMeasurementOverrides: _dropCb, ...fitWithoutCb } = fitBase;
  const fitForSave =
    Object.keys(measurementOverrides).length > 0
      ? { ...fitWithoutCb, cbMeasurementOverrides: { ...measurementOverrides } }
      : fitWithoutCb;

  const allowDropShoulder = isActiveDropShoulderConstruction();
  let customOverrides = options.customOverrides ?? {};
  if (allowDropShoulder) {
    customOverrides = withDropShoulderConstructionFamily(customOverrides);
  }

  pattern = preparePatternRecordForSave(
    {
      ...pattern,
      fit: fitForSave,
      patternProject: {
        ...meta,
        title: resolvedName,
      },
    },
    { customOverrides, allowDropShoulder },
  );

  const payload: SaveCustomPatternProjectRequest = {
    name: resolvedName,
    notes: meta.notes,
    family: options.family ?? "sleeveless",
    source: options.source ?? inferCustomPatternProjectSource(pattern),
    pattern,
    customOverrides,
  };

  logCustomPatternSavePayloadDiagnostics(payload, {
    phase: "before-save",
    patternId: readActiveCustomPatternProjectId() || pattern.id,
    mode: readActiveCustomPatternProjectId() ? "update" : "create",
  });

  return payload;
}

export async function createCustomPatternProject(
  payload: SaveCustomPatternProjectRequest,
): Promise<
  | { ok: true; project: CustomPatternProject; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  let entitlement: PatternSaveEntitlementSnapshot | undefined;
  if (typeof window !== "undefined") {
    const patternSystem = resolvePatternSystemForSavePayload(payload);
    entitlement = await buildPatternSaveEntitlementSnapshot(patternSystem);
  }

  const res = await projectFetch<{ project: CustomPatternProject }>("custom-pattern-project-save", {
    method: "POST",
    body: JSON.stringify({ ...payload, ...(entitlement ? { entitlement } : {}) }),
  });
  if (!res.ok) return res;
  return { ok: true, project: res.project, authMode: res.authMode };
}

export async function updateCustomPatternProject(
  payload: UpdateCustomPatternProjectRequest,
): Promise<
  | { ok: true; project: CustomPatternProject; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const res = await projectFetch<{ project: CustomPatternProject }>("custom-pattern-project-update", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) return res;
  logCustomPatternSavePayloadDiagnostics(
    {
      name: res.project.name,
      notes: res.project.notes,
      family: res.project.family,
      source: res.project.source,
      pattern: res.project.pattern,
      customOverrides: res.project.customOverrides ?? {},
    },
    {
      phase: "after-save",
      patternId: res.project.id,
      mode: "update",
    },
  );
  return { ok: true, project: res.project, authMode: res.authMode };
}

/** Persist My Pattern reading workflow only (tips, chart progress, section collapse). */
export async function patchCustomPatternProjectReadingWorkflow(
  id: string,
  readingWorkflow: PatternReadingWorkflowState,
  family: CustomPatternFamily = "sleeveless",
): Promise<
  | { ok: true; project: CustomPatternProject; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const res = await projectFetch<{ project: CustomPatternProject }>("custom-pattern-project-update", {
    method: "PUT",
    body: JSON.stringify({ id, family, workflowOnly: true, readingWorkflow }),
  });
  if (!res.ok) return res;
  return { ok: true, project: res.project, authMode: res.authMode };
}

export async function loadCustomPatternProject(
  id: string,
  family: CustomPatternFamily = "sleeveless",
): Promise<
  | { ok: true; project: CustomPatternProject; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({ id, family });
  const res = await projectFetch<{ project: CustomPatternProject }>(
    `custom-pattern-project-load?${params}`,
    { method: "GET" },
  );
  if (!res.ok) return res;
  return { ok: true, project: res.project, authMode: res.authMode };
}

export async function listCustomPatternProjects(
  family: CustomPatternFamily = "sleeveless",
): Promise<
  | { ok: true; projects: CustomPatternProjectSummary[]; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({ family });
  const res = await projectFetch<{ projects: CustomPatternProjectSummary[] }>(
    `custom-pattern-project-list?${params}`,
    { method: "GET" },
  );
  if (!res.ok) return res;
  return { ok: true, projects: res.projects ?? [], authMode: res.authMode };
}

export async function deleteCustomPatternProject(
  projectId: string,
  family: CustomPatternFamily = "sleeveless",
  access?: SleevelessUserAccess,
  patternSystem?: PatternSystemId,
): Promise<
  | { ok: true; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const resolvedAccess = access ?? (await resolveSleevelessUserAccessSnapshot());
  const systemId = patternSystem ?? resolvePatternSystemFromPage();
  const freeClaim = {
    patternSystem: systemId,
    hasSystemAccess: resolvedAccess.hasSystemAccess === true,
    freeClaimedForSystem: isFreeClaimedForSystem(resolvedAccess.freeClaimsBySystem, systemId),
    ...(freeClaimedPatternIdForSystem(resolvedAccess.freeClaimsBySystem, systemId)
      ? {
          freeClaimedPatternId: freeClaimedPatternIdForSystem(
            resolvedAccess.freeClaimsBySystem,
            systemId,
          ),
        }
      : {}),
  };

  const res = await projectFetch<{ deleted: true }>("custom-pattern-project-delete", {
    method: "DELETE",
    body: JSON.stringify({ id: projectId, family, freeClaim }),
  });
  if (!res.ok) return res;
  return { ok: true, authMode: res.authMode };
}

function patternSectionRecord(section: unknown): Record<string, unknown> {
  return section && typeof section === "object" && !Array.isArray(section)
    ? (section as Record<string, unknown>)
    : {};
}

/** Temporary diagnostics for saved-pattern update identity (remove after production verification). */
export function logSavedPatternUpdateFlowDiagnostics(
  label: string,
  extra: Record<string, unknown> = {},
): void {
  if (typeof console === "undefined" || typeof console.info !== "function") return;
  const pattern = getCurrentPattern();
  console.info("[kbm] saved-pattern update flow", {
    label,
    activeSavedProjectId: readActiveCustomPatternProjectId(),
    activeSavedProjectLinkedName: readActiveCustomPatternProjectLinkedName(),
    workingDraftPatternRecordId: pattern.id,
    ...extra,
  });
}

/** Dev logging for saved-pattern update/create payload diagnostics. */
export function logCustomPatternSavePayloadDiagnostics(
  payload: SaveCustomPatternProjectRequest,
  context: {
    phase: "before-save" | "after-save";
    patternId?: string;
    mode?: "create" | "update";
  },
): void {
  if (typeof console === "undefined" || typeof console.info !== "function") return;

  const pattern = payload.pattern;
  const fit = patternSectionRecord(pattern.fit);
  const sm = patternSectionRecord(fit.selectedMeasurements);
  const yarnGauge = patternSectionRecord(pattern.yarnGauge);
  const machine = patternSectionRecord(pattern.machine);
  const instructions = patternSectionRecord(pattern.instructions);
  const calculations = patternSectionRecord(pattern.calculations);

  console.info("[kbm] custom-pattern save payload", {
    phase: context.phase,
    mode: context.mode,
    patternId: context.patternId ?? pattern.id,
    patternType: pattern.patternType,
    payloadKeys: ["name", "notes", "family", "source", "pattern", "customOverrides"].filter(
      (key) => key in payload,
    ),
    patternSectionKeys: Object.keys(pattern).filter(
      (key) => !["id", "createdAt", "updatedAt"].includes(key),
    ),
    summaryFieldsPresent: {
      selectedMeasurements: Object.keys(sm).length > 0,
      finishedBustChest: sm.finished_bust_chest !== undefined && sm.finished_bust_chest !== "",
      stitchGaugePerInch: yarnGauge.stitchGauge !== undefined && yarnGauge.stitchGauge !== "",
      gaugeStitchRaw: yarnGauge.gaugeStitchRaw !== undefined && yarnGauge.gaugeStitchRaw !== "",
      availableNeedles: machine.availableNeedles !== undefined && machine.availableNeedles !== "",
      instructions: Object.keys(instructions).length > 0,
      calculations: Object.keys(calculations).length > 0,
    },
  });
}

/**
 * Saved projects must be self-contained in `pattern` — merge builder mirrors
 * (`patternBuilderData`) into canonical sections before persisting.
 */
function mergeWorkingDraftForCustomPatternSave(
  canonical: SleevelessPatternRecord,
): SleevelessPatternRecord {
  const merged = mergedPatternForDisplayFromSources(canonical, getPatternData());
  return {
    ...canonical,
    style: patternSectionRecord(merged.style),
    fit: patternSectionRecord(merged.fit),
    yarnGauge: patternSectionRecord(merged.yarnGauge),
    machine: patternSectionRecord(merged.machine),
  };
}

/**
 * Copies a saved project into the working draft (`kbm_current_pattern` + `patternBuilderData` mirrors).
 * Does not change Express routes or pattern math — only restores stored sections.
 *
 * Does not prefill the Express wizard — use Change Pattern Choices for that.
 */
export function loadProjectIntoWorkingDraft(project: CustomPatternProject): SleevelessPatternRecord {
  const sanitized = sanitizeSavedProjectForHydration(project);
  const pattern = sanitized.pattern;
  const notes =
    typeof sanitized.notes === "string"
      ? sanitized.notes
      : typeof pattern.patternProject?.notes === "string"
        ? pattern.patternProject.notes
        : "";

  const record = replaceWorkingDraftFromSavedPattern(pattern, {
    title: sanitized.name,
    notes,
    titleCustomized: true,
  });

  writeHydratedConstructionBaseline(sanitized);

  try {
    applySleevelessReadingWorkflow(sanitized.readingWorkflow, pattern.id);
  } catch (error) {
    console.error("[kbm] Reading workflow restore failed; continuing.", error);
  }
  return record;
}

/** Exported for tests — block update when drop-shoulder draft drift would corrupt a sleeveless id. */
export function shouldBlockDropShoulderConstructionSaveToActiveProject(): boolean {
  const activeId = readActiveCustomPatternProjectId();
  if (!activeId) return false;
  return draftHasUnsavedDropShoulderConstructionDrift(isActiveDropShoulderConstruction(), activeId);
}

/** Exported for tests — detect corrupted sleeveless blobs before hydration sanitize. */
export function savedProjectHasCorruptedSleevelessConstruction(project: CustomPatternProject): boolean {
  return isCorruptedSleevelessConstruction(project.pattern, project.customOverrides);
}

/** Exported for tests — authoritative drop-shoulder stamp on a saved project. */
export function savedProjectHasAuthoritativeDropShoulderConstruction(
  project: CustomPatternProject,
): boolean {
  return hasAuthoritativeDropShoulderConstruction(
    patternSectionRecord(project.pattern.style),
    project.customOverrides,
  );
}
