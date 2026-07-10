/**
 * Authoritative loader for the read-only saved-pattern View page.
 *
 * When the destination URL carries an explicit `project` id (see {@link savedPatternViewUrl}), that
 * id is the single source of truth: we (re)load that exact saved project into the working draft on
 * arrival, overriding whatever localStorage happened to hold. This defeats the intermittent race
 * where an outgoing pattern page re-wrote the shared draft after the drawer hydrated, and it makes a
 * direct reload of a saved-pattern URL reopen the same project.
 *
 * If the requested id cannot be loaded, the `project` param is stripped so the page falls back to the
 * normal reconciliation / self-heal path. When there is no `project` id (brand-new unsaved patterns,
 * builder handoff, etc.) this is a no-op and existing behavior is preserved.
 */
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import {
  readSavedPatternProjectIdFromUrl,
  stripSavedPatternProjectIdFromLocation,
} from "./savedPatternViewUrl";

export type EnsureUrlRequestedSavedPatternResult =
  | "no-url-project"
  | "loaded"
  | "load-failed";

export interface EnsureUrlRequestedSavedPatternDeps {
  readUrlProjectId?: () => string;
  loadSaved?: (id: string) => Promise<{ ok: boolean }>;
  stripUrlProjectId?: () => void;
  family?: CustomPatternFamily;
}

export async function ensureUrlRequestedSavedPatternHydrated(
  deps: EnsureUrlRequestedSavedPatternDeps = {},
): Promise<EnsureUrlRequestedSavedPatternResult> {
  const readUrlId = deps.readUrlProjectId ?? readSavedPatternProjectIdFromUrl;
  const family = deps.family ?? "sleeveless";
  const loadSaved =
    deps.loadSaved ?? ((id: string) => loadSavedCustomPatternProject(id, "view", family));
  const stripId = deps.stripUrlProjectId ?? stripSavedPatternProjectIdFromLocation;

  const urlId = readUrlId();
  if (!urlId) return "no-url-project";

  const result = await loadSaved(urlId);
  if (!result.ok) {
    // The requested id is unusable (deleted, not owned, offline). Drop it so the page can fall back
    // to reconciliation / self-heal instead of insisting on a project it cannot show.
    stripId();
    return "load-failed";
  }
  return "loaded";
}
