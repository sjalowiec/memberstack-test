/**
 * Help Hub slug check shared by activity storage and GA4.
 * No question text, member id, or email is accepted.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function cleanHelpHubDiscoverySlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > 120 || !SLUG.test(slug)) return null;
  return slug;
}
