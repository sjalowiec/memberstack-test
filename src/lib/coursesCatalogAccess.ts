/**
 * Course access lookup from the catalog file.
 *
 * Kept in its own module (only depends on the catalog JSON + `courseAccess`) so
 * both `coursesCatalog.ts` and `legacy_kin/courseLanding.ts` can read a course's
 * access level without creating a circular import between them.
 *
 * Access is resolved from `courses-catalog.json` `entries[].access`. Courses that
 * are not tagged fall back to "premium" (locked), so nothing leaks through an
 * accidental omission � but every catalog course should be tagged explicitly.
 */
import catalogFile from "../data/courses-catalog.json";
import { normalizeCourseAccessLevel, type CourseAccessLevel } from "./courseAccess";

type CatalogAccessEntry = { slug: string; access?: string };

const entries = (catalogFile as { entries: CatalogAccessEntry[] }).entries ?? [];

/** Resolve a course's access level by slug (defaults to "premium" when untagged). */
export function getCourseAccessBySlug(slug: string): CourseAccessLevel {
  const entry = entries.find((e) => e.slug === slug);
  return normalizeCourseAccessLevel(entry?.access, "premium");
}
