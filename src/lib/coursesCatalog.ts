import catalogFile from "../data/courses-catalog.json";
import {
  getLegacyCourseBySlug,
  legacyCourseHref,
} from "./legacy_kin/legacyCourseLoader";
import { legacyAssetUrl } from "./legacy_kin/legacyCourseAssetUrls";
import {
  isLegacyCourseActive,
  type LegacyCoursePublicationFields,
} from "./legacy_kin/legacyCoursePublication";

export type CourseCatalogStatus = "available" | "in-progress" | "coming-soon";

export type CourseCatalogEntry = {
  slug: string;
  title: string;
  description?: string;
  /** Resolved thumbnail URL/path for the card image, if any. */
  thumbnail?: string;
  hasThumbnail: boolean;
  category: string;
  status: CourseCatalogStatus;
  href?: string;
  buttonLabel: string;
};

type CatalogFileEntry = {
  slug: string;
  category: string;
  catalogStatus: CourseCatalogStatus;
  description?: string;
  /** @deprecated Prefer `course.thumbnail` in the course JSON file. */
  thumbnail?: string;
};

type CoursesCatalogFile = {
  categories: string[];
  entries: CatalogFileEntry[];
};

const catalog = catalogFile as CoursesCatalogFile;

const STATUS_LABELS: Record<CourseCatalogStatus, string> = {
  available: "Available",
  "in-progress": "In Progress",
  "coming-soon": "Coming Soon",
};

const STATUS_BUTTONS: Record<CourseCatalogStatus, string> = {
  available: "Start course",
  "in-progress": "In progress",
  "coming-soon": "Coming soon",
};

export function getCourseCatalogCategories(): string[] {
  return [...catalog.categories];
}

function legacyCourseForEntry(slug: string, catalogStatus: CourseCatalogStatus) {
  const includeDrafts = catalogStatus !== "available";
  return getLegacyCourseBySlug(slug, { includeDrafts });
}

function resolveTitle(slug: string, catalogStatus: CourseCatalogStatus): string {
  return legacyCourseForEntry(slug, catalogStatus)?.course.title ?? slug;
}

function resolveDescription(
  slug: string,
  catalogStatus: CourseCatalogStatus,
  fallback?: string,
): string | undefined {
  if (fallback?.trim()) return fallback.trim();
  const legacy = legacyCourseForEntry(slug, catalogStatus);
  const legacyDescription =
    legacy &&
    "description" in legacy.course &&
    typeof legacy.course.description === "string"
      ? legacy.course.description
      : undefined;
  return legacyDescription?.trim() || undefined;
}

/** Course JSON thumbnail wins; catalog overlay thumbnail is a legacy fallback only. */
export function resolveCourseThumbnail(
  slug: string,
  catalogStatus: CourseCatalogStatus,
  catalogThumbnail?: string,
): string | undefined {
  const legacy = legacyCourseForEntry(slug, catalogStatus);
  const courseThumbnail =
    legacy &&
    "thumbnail" in legacy.course &&
    typeof legacy.course.thumbnail === "string"
      ? legacy.course.thumbnail.trim()
      : "";
  if (courseThumbnail) return legacyAssetUrl(courseThumbnail);

  const overlay = catalogThumbnail?.trim();
  if (overlay) return legacyAssetUrl(overlay);

  return undefined;
}

function resolveHref(
  slug: string,
  catalogStatus: CourseCatalogStatus,
): string | undefined {
  if (catalogStatus !== "available") return undefined;
  const legacy = getLegacyCourseBySlug(slug);
  if (!legacy) return undefined;
  return legacyCourseHref(slug);
}

/** Catalog rows for /courses, merged with legacy course metadata where available. */
export function getCourseCatalogEntries(): CourseCatalogEntry[] {
  return catalog.entries
    .filter((entry) => {
      const legacy = legacyCourseForEntry(entry.slug, entry.catalogStatus);
      if (!legacy) return entry.catalogStatus !== "available";
      return isLegacyCourseActive(legacy.course as LegacyCoursePublicationFields);
    })
    .map((entry) => {
      const status = entry.catalogStatus;
      const thumbnail = resolveCourseThumbnail(entry.slug, status, entry.thumbnail);
      return {
        slug: entry.slug,
        title: resolveTitle(entry.slug, status),
        description: resolveDescription(entry.slug, status, entry.description),
        thumbnail,
        hasThumbnail: Boolean(thumbnail),
        category: entry.category,
        status,
        href: resolveHref(entry.slug, status),
        buttonLabel: STATUS_BUTTONS[status],
      };
    });
}

export function getCourseCatalogEntriesByCategory(): {
  category: string;
  courses: CourseCatalogEntry[];
}[] {
  const entries = getCourseCatalogEntries();
  const grouped = new Map<string, CourseCatalogEntry[]>();

  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  return catalog.categories
    .filter((category) => grouped.has(category))
    .map((category) => ({
      category,
      courses: grouped.get(category) ?? [],
    }));
}

export function courseCatalogStatusLabel(status: CourseCatalogStatus): string {
  return STATUS_LABELS[status];
}
