/** Tracks which saved Custom Pattern project is active for Update in the design/review panels. */
export const CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY = "kbm_custom_pattern_active_project_id";

/** Saved project name at link time — used for Save Copy default title, not as an identifier. */
export const CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY = "kbm_custom_pattern_active_project_name";

export function readActiveCustomPatternProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readActiveCustomPatternProjectLinkedName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeActiveCustomPatternProjectId(id: string, linkedName?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY, id);
      if (linkedName !== undefined) {
        const trimmed = linkedName.trim();
        if (trimmed) localStorage.setItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY, trimmed);
        else localStorage.removeItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY);
      }
    } else {
      localStorage.removeItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Clears the link between the working draft and a saved Blob project.
 * Call when starting a brand-new pattern (Express reset, session clear, etc.).
 * Does not delete the saved project from account storage.
 */
export function clearActiveCustomPatternProjectId(): void {
  writeActiveCustomPatternProjectId("");
}
