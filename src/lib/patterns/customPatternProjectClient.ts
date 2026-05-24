/**
 * Client API for saved Custom Pattern projects (Netlify Functions + Blobs).
 *
 * **Draft vs saved:** `localStorage` key `kbm_current_pattern` is the working draft for the current
 * browser session. Blob storage holds named saved projects; loading a project copies it into the draft.
 */
import {
  getCurrentPattern,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";
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

const FN_BASE = "/.netlify/functions";

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
  }> = {},
): SaveCustomPatternProjectRequest {
  const pattern = getCurrentPattern();
  const meta = getPatternProjectMeta(pattern);
  const resolvedName = (name ?? meta.title).trim() || "Untitled pattern";
  return {
    name: resolvedName,
    notes: meta.notes,
    family: options.family ?? "sleeveless",
    source: options.source ?? inferCustomPatternProjectSource(pattern),
    pattern: {
      ...pattern,
      patternProject: {
        ...meta,
        title: resolvedName,
      },
    },
    customOverrides: options.customOverrides ?? {},
  };
}

export async function createCustomPatternProject(
  payload: SaveCustomPatternProjectRequest,
): Promise<
  | { ok: true; project: CustomPatternProject; authMode?: CustomPatternProjectAuthMode }
  | { ok: false; error: string }
> {
  const res = await projectFetch<{ project: CustomPatternProject }>("custom-pattern-project-save", {
    method: "POST",
    body: JSON.stringify(payload),
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

function patternSectionRecord(section: unknown): Record<string, unknown> {
  return section && typeof section === "object" && !Array.isArray(section)
    ? (section as Record<string, unknown>)
    : {};
}

/**
 * Copies a saved project into the working draft (`kbm_current_pattern` + `patternBuilderData` mirrors).
 * Does not change Express routes or pattern math — only restores stored sections.
 *
 * Does not prefill the Express wizard — use Change Pattern Choices for that.
 */
export function loadProjectIntoWorkingDraft(project: CustomPatternProject): SleevelessPatternRecord {
  const pattern = project.pattern;
  const notes =
    typeof project.notes === "string"
      ? project.notes
      : typeof pattern.patternProject?.notes === "string"
        ? pattern.patternProject.notes
        : "";
  saveCurrentPattern({
    style: patternSectionRecord(pattern.style),
    fit: patternSectionRecord(pattern.fit),
    yarnGauge: patternSectionRecord(pattern.yarnGauge),
    measurements: patternSectionRecord(pattern.measurements),
    machine: patternSectionRecord(pattern.machine),
    calculations: patternSectionRecord(pattern.calculations),
    instructions: patternSectionRecord(pattern.instructions),
    version: pattern.version,
    patternProject: {
      title: project.name,
      notes,
      titleCustomized: true,
    },
  });
  savePatternData("style", patternSectionRecord(pattern.style));
  savePatternData("fit", patternSectionRecord(pattern.fit));
  savePatternData("yarnGauge", patternSectionRecord(pattern.yarnGauge));
  savePatternData("measurements", patternSectionRecord(pattern.measurements));
  savePatternData("machine", patternSectionRecord(pattern.machine));
  try {
    applySleevelessReadingWorkflow(project.readingWorkflow, pattern.id);
  } catch (error) {
    console.error("[kbm] Reading workflow restore failed; continuing.", error);
  }
  return getCurrentPattern();
}
