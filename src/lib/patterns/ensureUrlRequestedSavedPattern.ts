/**
 * Authoritative loader for the read-only saved-pattern View page.
 *
 * When the destination URL carries an explicit `project` id (see {@link savedPatternViewUrl}), that
 * id is the single source of truth: we (re)load that exact saved project into the working draft on
 * arrival, overriding whatever localStorage happened to hold.
 *
 * If the requested id cannot be loaded, this is a terminal failure for that URL. Callers must show
 * an unavailable state and must not fall back to a different localStorage draft. The `project` id
 * stays in the URL. New-pattern flows and the free Hat builder without `project=` are unchanged.
 */
import {
  SAVED_PATTERN_UNAVAILABLE_BODY,
  SAVED_PATTERN_UNAVAILABLE_TITLE,
} from "./savedPatternAccessState";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import { readSavedPatternProjectIdFromUrl } from "./savedPatternViewUrl";

export type EnsureUrlRequestedSavedPatternResult =
  | "no-url-project"
  | "loaded"
  | "load-failed";

export interface EnsureUrlRequestedSavedPatternDeps {
  readUrlProjectId?: () => string;
  loadSaved?: (id: string) => Promise<{ ok: boolean }>;
  /** @deprecated Ignored — failed loads no longer strip the id or self-heal. */
  stripUrlProjectId?: () => void;
  family?: CustomPatternFamily;
}

let lastAuthoritativeLoadFailed = false;

export function didAuthoritativeSavedPatternLoadFail(): boolean {
  return lastAuthoritativeLoadFailed;
}

export function resetAuthoritativeSavedPatternLoadFlagForTests(): void {
  lastAuthoritativeLoadFailed = false;
}

export async function ensureUrlRequestedSavedPatternHydrated(
  deps: EnsureUrlRequestedSavedPatternDeps = {},
): Promise<EnsureUrlRequestedSavedPatternResult> {
  lastAuthoritativeLoadFailed = false;
  const readUrlId = deps.readUrlProjectId ?? readSavedPatternProjectIdFromUrl;
  const family = deps.family ?? "sleeveless";
  const loadSaved =
    deps.loadSaved ?? ((id: string) => loadSavedCustomPatternProject(id, "view", family));

  const urlId = readUrlId();
  if (!urlId) return "no-url-project";

  const result = await loadSaved(urlId);
  if (!result.ok) {
    lastAuthoritativeLoadFailed = true;
    return "load-failed";
  }
  return "loaded";
}

export function applySavedPatternUnavailableMessage(root: ParentNode = document): void {
  const titleEl = root.querySelector("[data-saved-pattern-unavailable-title]");
  const bodyEl = root.querySelector("[data-saved-pattern-unavailable-message]");
  if (titleEl) titleEl.textContent = SAVED_PATTERN_UNAVAILABLE_TITLE;
  if (bodyEl) bodyEl.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;

  const emptyMessages = root.querySelectorAll(
    [
      "[data-socks-pattern-empty-message]",
      "[data-socks-edit-empty-message]",
      "[data-hat-pattern-empty-message]",
      "[data-hat-summary-empty-message]",
      "[data-sleeveless-pattern-boot-msg]",
      "[data-sideways-calc-missing]",
    ].join(","),
  );
  emptyMessages.forEach((el) => {
    el.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;
  });
}
