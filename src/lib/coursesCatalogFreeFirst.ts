/**
 * Courses catalog free-first ordering for non-members.
 *
 * Non-members need free courses near the top of the page. Sorting only inside
 * each category is not enough when a member-only category is listed first in
 * the catalog (the observed localhost failure mode).
 */
import { sortWithFreeContentFirst } from "./catalogFreeContentFirst";
import type { CourseCatalogEntry } from "./coursesCatalog";
import { hasMemberAccess } from "./memberAccess";

export type CourseCatalogSection = {
  category: string;
  courses: CourseCatalogEntry[];
};

export type OrderedCourseCatalogEntry = CourseCatalogEntry & {
  catalogCardOrder: number;
};

export type OrderedCourseCatalogSection = {
  category: string;
  catalogSectionOrder: number;
  courses: OrderedCourseCatalogEntry[];
};

/** Stamp stable catalog positions before any free-first reordering. */
export function withCourseCatalogOrders(
  sections: readonly CourseCatalogSection[],
): OrderedCourseCatalogSection[] {
  return sections.map((section, catalogSectionOrder) => ({
    category: section.category,
    catalogSectionOrder,
    courses: section.courses.map((course, catalogCardOrder) => ({
      ...course,
      catalogCardOrder,
    })),
  }));
}

/**
 * Sort category sections and courses for the viewer.
 * When preferFreeFirst:
 *   1) sections that contain a free course come first (stable among peers)
 *   2) within each section, free courses come first (stable among peers)
 * When false, original catalog order fields are restored.
 */
export function sortCourseCatalogSectionsForViewer(
  sections: readonly OrderedCourseCatalogSection[],
  preferFreeFirst: boolean,
): OrderedCourseCatalogSection[] {
  if (!preferFreeFirst) {
    const bySection = [...sections].sort(
      (a, b) => a.catalogSectionOrder - b.catalogSectionOrder,
    );
    return bySection.map((section) => ({
      ...section,
      courses: [...section.courses].sort(
        (a, b) => a.catalogCardOrder - b.catalogCardOrder,
      ),
    }));
  }

  const withCoursesSorted = sections.map((section) => ({
    ...section,
    courses: sortWithFreeContentFirst(section.courses, {
      isFree: (course) => course.access === "free",
      preferFreeFirst: true,
      compare: (a, b) => a.catalogCardOrder - b.catalogCardOrder,
    }),
  }));

  return sortWithFreeContentFirst(withCoursesSorted, {
    isFree: (section) => section.courses.some((course) => course.access === "free"),
    preferFreeFirst: true,
    compare: (a, b) => a.catalogSectionOrder - b.catalogSectionOrder,
  });
}

/**
 * Free-first unless the viewer has active member access.
 * Missing / null Memberstack payloads are treated as non-member.
 */
export function preferCourseCatalogFreeFirst(memberOrPayload: unknown): boolean {
  return !hasMemberAccess(memberOrPayload);
}

export type CourseCatalogDomOrderResult = {
  preferFreeFirst: boolean;
  sectionCount: number;
  cardCount: number;
  freeSlugs: string[];
  sectionOrder: string[];
};

/**
 * Reorder rendered course catalog DOM for the viewer.
 * Free status comes only from `data-course-access="free"` (not lock visibility).
 */
export function applyCourseCatalogDomOrder(
  root: ParentNode,
  preferFreeFirst: boolean,
): CourseCatalogDomOrderResult {
  const page = root.querySelector(".courses-page");
  const result: CourseCatalogDomOrderResult = {
    preferFreeFirst,
    sectionCount: 0,
    cardCount: 0,
    freeSlugs: [],
    sectionOrder: [],
  };
  if (!page) return result;

  const sections = Array.from(page.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.classList.contains("courses-catalog"),
  );
  result.sectionCount = sections.length;

  const orderedSections = preferFreeFirst
    ? sortWithFreeContentFirst(sections, {
        isFree: (section) =>
          Boolean(section.querySelector('[data-course-access="free"]')),
        preferFreeFirst: true,
        compare: (a, b) =>
          Number(a.dataset.catalogSectionOrder ?? 0) -
          Number(b.dataset.catalogSectionOrder ?? 0),
      })
    : [...sections].sort(
        (a, b) =>
          Number(a.dataset.catalogSectionOrder ?? 0) -
          Number(b.dataset.catalogSectionOrder ?? 0),
      );

  for (const section of orderedSections) {
    page.appendChild(section);
  }

  for (const section of orderedSections) {
    const grid = section.querySelector(".courses-grid");
    if (!grid) continue;

    const cards = Array.from(grid.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el.hasAttribute("data-course-catalog-card"),
    );
    result.cardCount += cards.length;

    for (const card of cards) {
      if (card.getAttribute("data-course-access") === "free") {
        const slug = card.getAttribute("data-course-slug");
        if (slug) result.freeSlugs.push(slug);
      }
    }

    const orderedCards = preferFreeFirst
      ? sortWithFreeContentFirst(cards, {
          isFree: (card) => card.getAttribute("data-course-access") === "free",
          preferFreeFirst: true,
          compare: (a, b) =>
            Number(a.dataset.catalogCardOrder ?? 0) -
            Number(b.dataset.catalogCardOrder ?? 0),
        })
      : [...cards].sort(
          (a, b) =>
            Number(a.dataset.catalogCardOrder ?? 0) -
            Number(b.dataset.catalogCardOrder ?? 0),
        );

    for (const card of orderedCards) {
      grid.appendChild(card);
    }
  }

  result.sectionOrder = orderedSections.map(
    (section) =>
      section.querySelector(".courses-section-title")?.textContent?.trim() ||
      section.getAttribute("aria-labelledby") ||
      "",
  );

  return result;
}
