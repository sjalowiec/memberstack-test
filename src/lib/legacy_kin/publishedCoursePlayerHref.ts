import catalogFile from "../../data/courses-catalog.json";
import { resolveCatalogStatus, type CourseCatalogStatus } from "../coursesCatalog";
import { kinCourseHomeHref } from "../kinCourse/hrefs";
import { parseLegacyChallengeIdFromHref } from "./courseEnvironmentHref";
import {
  getLegacyCourseRecordBySlug,
  getLegacyCourses,
  type LegacyCourseRecord,
} from "./legacyCourseLoader";
import { readLegacyCoursePublished } from "./legacyCoursePublication";

type CatalogPlayerEntry = {
  slug: string;
  catalogStatus: CourseCatalogStatus;
  href?: string;
};

const catalogEntries = (catalogFile as { entries?: CatalogPlayerEntry[] }).entries ?? [];

function findCourseRecord(slug: string): LegacyCourseRecord | undefined {
  const exact = getLegacyCourseRecordBySlug(slug);
  if (exact) return exact;

  const prefixed = getLegacyCourses({ includeDrafts: true }).filter((course) =>
    course.slug.startsWith(`${slug}-`),
  );
  if (prefixed.length !== 1) return undefined;
  return getLegacyCourseRecordBySlug(prefixed[0].slug);
}

function findCatalogEntry(
  slug: string,
  record: LegacyCourseRecord | undefined,
): CatalogPlayerEntry | undefined {
  const exact = catalogEntries.find((entry) => entry.slug === slug);
  if (exact) return exact;
  if (!record) return undefined;

  const byCourseSlug = catalogEntries.find((entry) => entry.slug === record.course.slug);
  if (byCourseSlug) return byCourseSlug;

  const challengeId = record.course.legacyChallengeId;
  const byPlayerId = catalogEntries.filter(
    (entry) => parseLegacyChallengeIdFromHref(entry.href) === challengeId,
  );
  if (byPlayerId.length === 1) return byPlayerId[0];

  const byPrefix = catalogEntries.filter((entry) =>
    record.course.slug.startsWith(`${entry.slug}-`),
  );
  if (byPrefix.length === 1) return byPrefix[0];
  return undefined;
}

/**
 * Numeric player for a named slug when that course is published and the
 * catalog still lists it as available. Content cleanup status does not matter.
 * Unpublished and not-yet-available courses return undefined so their
 * notify-me landing stays in place.
 */
export function publishedAvailablePlayerHref(slug: string): string | undefined {
  const normalized = slug.trim();
  if (!normalized || /^\d+$/.test(normalized)) return undefined;

  const record = findCourseRecord(normalized);
  if (!record || !readLegacyCoursePublished(record.course)) return undefined;
  if (record.course.active === false) return undefined;

  const entry = findCatalogEntry(normalized, record);
  if (!entry) return undefined;
  if (resolveCatalogStatus(entry.slug, entry.catalogStatus) !== "available") return undefined;

  const playerId = parseLegacyChallengeIdFromHref(entry.href);
  if (playerId == null || playerId !== record.course.legacyChallengeId) return undefined;
  return kinCourseHomeHref(playerId);
}
