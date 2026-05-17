/**
 * Netlify Blobs key layout for saved Custom Pattern projects.
 * Keep in sync with `netlify/functions/lib/custom-pattern-projects-store.js`.
 */
export const CUSTOM_PATTERN_PROJECTS_BLOB_STORE = "custom-pattern-projects";

/** Keep in sync with `netlify/functions/lib/custom-pattern-projects-store.js`. */
export const DEFAULT_DEV_PATTERN_USER_ID = "dev_local_pattern_user";

export function customPatternProjectBlobKey(
  family: string,
  userId: string,
  projectId: string,
): string {
  const safeFamily = sanitizeKeySegment(family);
  const safeUser = sanitizeKeySegment(userId);
  const safeId = sanitizeKeySegment(projectId);
  return `${safeFamily}/${safeUser}/${safeId}.json`;
}

export function customPatternProjectsListPrefix(family: string, userId: string): string {
  return `${sanitizeKeySegment(family)}/${sanitizeKeySegment(userId)}/`;
}

function sanitizeKeySegment(segment: string): string {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}
