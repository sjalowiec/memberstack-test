/** Tracks which saved Custom Pattern project is active for Update in the design/review panels. */
export const CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY = "kbm_custom_pattern_active_project_id";

export function readActiveCustomPatternProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeActiveCustomPatternProjectId(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) localStorage.setItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY, id);
    else localStorage.removeItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY);
  } catch {
    /* ignore */
  }
}
