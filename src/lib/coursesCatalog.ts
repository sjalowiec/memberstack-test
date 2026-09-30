import catalogFile from "../data/courses-catalog.json";
import type { CourseAccessLevel } from "./courseAccess";
import { getCourseAccessBySlug } from "./coursesCatalogAccess";
import { getCatalogOverlayDescription } from "./coursesCatalogOverlay";
import { readCourseContentStatus } from "./legacy_kin/courseContentAdmin";
import { resolveCatalogCourseHref, type CourseHrefResolveOptions } from "./legacy_kin/courseEnvironmentHref";
import { courseLandingHref } from "./legacy_kin/courseLanding";
import { getLegacyCourseBySlug } from "./legacy_kin/legacyCourseLoader";
import { legacyAssetUrl } from "./legacy_kin/legacyCourseAssetUrls";
import {
  isLegacyCourseActive,
  readLegacyCoursePublished,
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
  /** Gating tier: free (open), member / purchase (members; purchase also for future individual buys). */
  access: CourseAccessLevel;
};

type CatalogFileEntry = {
  slug: string;
  category: string;
  catalogStatus: CourseCatalogStatus;
  description?: string;
  /** Optional card title. When omitted, course JSON title (or the slug) is used. */
  title?: string;
  /** Optional destination override (absolute or site-relative). */
  href?: string;
  /** Optional CTA override. When omitted, status-based labels are used. */
  buttonLabel?: string;
  /** Gating tier: "free" | "member" | "purchase". Untagged → member (locked). */
  access?: string;
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

function readOptionalOverride(value?: string): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function legacyCourseForEntry(slug: string, catalogStatus: CourseCatalogStatus) {
  const includeDrafts = catalogStatus !== "available";
  return getLegacyCourseBySlug(slug, { includeDrafts });
}

function resolveTitle(
  slug: string,
  catalogStatus: CourseCatalogStatus,
  catalogTitle?: string,
): string {
  return readOptionalOverride(catalogTitle)
    ?? legacyCourseForEntry(slug, catalogStatus)?.course.title
    ?? slug;
}

function readCustomCatalogDescription(
  slug: string,
  catalogStatus: CourseCatalogStatus,
): string {
  const legacy = legacyCourseForEntry(slug, catalogStatus);
  if (
    legacy &&
    "description" in legacy.course &&
    typeof legacy.course.description === "string"
  ) {
    return legacy.course.description.trim();
  }
  return "";
}

export { getCatalogOverlayDescription } from "./coursesCatalogOverlay";

export type CourseCatalogDescriptionSource = "custom" | "fallback" | "none";

export type ResolvedCourseCatalogDescription = {
  /** Text shown on the /courses catalog card. */
  description?: string;
  source: CourseCatalogDescriptionSource;
  /** Non-empty only when source is "custom". */
  customDescription?: string;
  /** Non-empty only when source is "fallback" (or when custom is absent). */
  fallbackDescription?: string;
};

/** Resolve catalog card copy: optional course JSON override, else courses-catalog.json. */
export function resolveCourseCatalogDescription(
  slug: string,
  catalogStatus: CourseCatalogStatus,
  catalogOverlayDescription?: string,
): ResolvedCourseCatalogDescription {
  const customDescription = readCustomCatalogDescription(slug, catalogStatus);
  const fallbackDescription =
    catalogOverlayDescription?.trim() || getCatalogOverlayDescription(slug);

  if (customDescription) {
    return {
      description: customDescription,
      source: "custom",
      customDescription,
      fallbackDescription,
    };
  }

  if (fallbackDescription) {
    return {
      description: fallbackDescription,
      source: "fallback",
      fallbackDescription,
    };
  }

  return { source: "none" };
}

function resolveDescription(
  slug: string,
  catalogStatus: CourseCatalogStatus,
  catalogOverlayDescription?: string,
): string | undefined {
  return resolveCourseCatalogDescription(slug, catalogStatus, catalogOverlayDescription)
    .description;
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
  catalogHref?: string,
  env: CourseHrefResolveOptions = {},
): string | undefined {
  const override = readOptionalOverride(catalogHref);
  if (override) {
    return resolveCatalogCourseHref(slug, override, env);
  }

  const legacy = legacyCourseForEntry(slug, catalogStatus);
  if (!legacy) return undefined;
  return courseLandingHref(slug);
}

function resolveButtonLabel(
  status: CourseCatalogStatus,
  catalogButtonLabel?: string,
): string {
  return readOptionalOverride(catalogButtonLabel) ?? STATUS_BUTTONS[status];
}

/**
 * Catalog card badge/CTA status. Published cleaned courses are available.
 * Unpublished courses stay in-progress. A published in-progress course keeps
 * the catalog overlay status, so production listings marked available remain
 * available.
 */
export function resolveCatalogStatus(
  slug: string,
  catalogStatus: CourseCatalogStatus,
): CourseCatalogStatus {
  const legacy = legacyCourseForEntry(slug, catalogStatus);
  if (!legacy) return catalogStatus;

  const contentStatus = readCourseContentStatus(legacy.course);
  const published = readLegacyCoursePublished(
    legacy.course as LegacyCoursePublicationFields,
  );

  if (contentStatus === "cleaned" && published) {
    return "available";
  }
  if (!published || (contentStatus === "in_progress" && catalogStatus !== "available")) {
    return "in-progress";
  }
  return catalogStatus;
}

/** Catalog rows for /courses, merged with legacy course metadata where available. */
export function getCourseCatalogEntries(
  env: CourseHrefResolveOptions = {},
): CourseCatalogEntry[] {
  const publicCategories = new Set(catalog.categories);
  return catalog.entries
    .filter((entry) => publicCategories.has(entry.category))
    .filter((entry) => {
      // External / override destinations can appear without local course JSON.
      if (readOptionalOverride(entry.href)) return true;

      const legacy = legacyCourseForEntry(entry.slug, entry.catalogStatus);
      if (!legacy) return entry.catalogStatus !== "available";
      return isLegacyCourseActive(legacy.course as LegacyCoursePublicationFields);
    })
    .map((entry) => {
      const status = resolveCatalogStatus(entry.slug, entry.catalogStatus);
      const thumbnail = resolveCourseThumbnail(entry.slug, entry.catalogStatus, entry.thumbnail);
      return {
        slug: entry.slug,
        title: resolveTitle(entry.slug, entry.catalogStatus, entry.title),
        description: resolveDescription(entry.slug, entry.catalogStatus, entry.description),
        thumbnail,
        hasThumbnail: Boolean(thumbnail),
        category: entry.category,
        status,
        href: resolveHref(entry.slug, entry.catalogStatus, entry.href, env),
        buttonLabel: resolveButtonLabel(status, entry.buttonLabel),
        access: getCourseAccessBySlug(entry.slug),
      };
    });
}

export type CourseCatalogCategorySection = {
  category: string;
  courses: CourseCatalogEntry[];
};

/** Catalog categories that share one /courses heading. Entry categories stay unchanged. */
const MACHINE_SPECIFIC_CATALOG_CATEGORIES = new Set(["Silver Reed", "Taitexma", "Brother"]);
const LK150_CATALOG_CATEGORY = "LK-150";

export const MACHINE_SPECIFIC_COURSES_HEADING = "Machine-Specific Courses";
export const LK150_COURSES_HEADING = "LK-150 Courses";

export function getCourseCatalogEntriesByCategory(
  env: CourseHrefResolveOptions = {},
): CourseCatalogCategorySection[] {
  const entries = getCourseCatalogEntries(env);
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

/**
 * Display grouping for /courses.
 * Silver Reed, Taitexma, and Brother remain separate catalog categories and
 * render together under Machine-Specific Courses, in catalog order.
 * LK-150 renders as LK-150 Courses so later published LK-150 courses join it.
 * Other public categories keep their own headings.
 */
export function groupCourseCatalogSections(
  sections: readonly CourseCatalogCategorySection[],
): CourseCatalogCategorySection[] {
  const machineCourses: CourseCatalogEntry[] = [];
  const grouped: CourseCatalogCategorySection[] = [];
  let machineInserted = false;

  for (const section of sections) {
    if (MACHINE_SPECIFIC_CATALOG_CATEGORIES.has(section.category)) {
      machineCourses.push(...section.courses);
      if (!machineInserted) {
        grouped.push({
          category: MACHINE_SPECIFIC_COURSES_HEADING,
          courses: machineCourses,
        });
        machineInserted = true;
      }
      continue;
    }

    if (section.category === LK150_CATALOG_CATEGORY) {
      grouped.push({
        category: LK150_COURSES_HEADING,
        courses: section.courses,
      });
      continue;
    }

    grouped.push({
      category: section.category,
      courses: section.courses,
    });
  }

  return grouped;
}

export function courseCatalogStatusLabel(status: CourseCatalogStatus): string {
  return STATUS_LABELS[status];
}
