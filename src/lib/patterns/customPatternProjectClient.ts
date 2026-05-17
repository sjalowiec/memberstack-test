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
import type {
  CustomPatternFamily,
  CustomPatternProject,
  CustomPatternProjectSource,
  CustomPatternProjectSummary,
  SaveCustomPatternProjectRequest,
  UpdateCustomPatternProjectRequest,
} from "./customPatternProjectTypes";
import {
  authHeadersForCustomPatternProjects,
  resolveCustomPatternProjectAuth,
  type CustomPatternProjectAuthMode,
} from "./customPatternProjectAuth";

const FN_BASE = "/.netlify/functions";

type ApiOk<T> = { ok: true; authMode?: CustomPatternProjectAuthMode } & T;
type ApiErr = { ok: false; error: string };

async function projectFetch<T>(
  path: string,
  init: RequestInit,
): Promise<(ApiOk<T> & T) | ApiErr> {
  const auth = await resolveCustomPatternProjectAuth();
  const headers = {
    "Content-Type": "application/json",
    ...authHeadersForCustomPatternProjects(auth),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (auth.mode === "none") {
    return {
      ok: false,
      error: "Sign in to save Custom Pattern projects.",
    };
  }

  const res = await fetch(`${FN_BASE}/${path}`, { ...init, headers });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `Request failed (${res.status}).` };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: `Request failed (${res.status}).` };
  }
  const body = data as Record<string, unknown>;
  if (!body.ok) {
    return { ok: false, error: typeof body.error === "string" ? body.error : "Request failed." };
  }
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
  name: string,
  options: Partial<{
    family: CustomPatternFamily;
    source: CustomPatternProjectSource;
    customOverrides: Record<string, unknown>;
  }> = {},
): SaveCustomPatternProjectRequest {
  const pattern = getCurrentPattern();
  return {
    name: name.trim() || "Untitled pattern",
    family: options.family ?? "sleeveless",
    source: options.source ?? inferCustomPatternProjectSource(pattern),
    pattern,
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

/**
 * Copies a saved project into the working draft (`kbm_current_pattern` + `patternBuilderData` mirrors).
 * Does not change Express routes or pattern math — only restores stored sections.
 */
export function loadProjectIntoWorkingDraft(project: CustomPatternProject): SleevelessPatternRecord {
  const pattern = project.pattern;
  saveCurrentPattern({
    style: pattern.style,
    fit: pattern.fit,
    yarnGauge: pattern.yarnGauge,
    measurements: pattern.measurements,
    machine: pattern.machine,
    calculations: pattern.calculations,
    instructions: pattern.instructions,
    version: pattern.version,
  });
  savePatternData("style", pattern.style);
  savePatternData("fit", pattern.fit);
  savePatternData("yarnGauge", pattern.yarnGauge);
  savePatternData("measurements", pattern.measurements);
  savePatternData("machine", pattern.machine);
  return getCurrentPattern();
}
