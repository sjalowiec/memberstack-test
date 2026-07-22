import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import type { CourseCatalogEntry } from "./coursesCatalog";
import {
  preferCourseCatalogFreeFirst,
  sortCourseCatalogSectionsForViewer,
  withCourseCatalogOrders,
} from "./coursesCatalogFreeFirst";

function entry(
  slug: string,
  access: CourseCatalogEntry["access"],
  category: string,
): CourseCatalogEntry {
  return {
    slug,
    title: slug,
    category,
    status: "available",
    hasThumbnail: false,
    buttonLabel: "Start course",
    access,
  };
}

const catalogSections = withCourseCatalogOrders([
  {
    category: "Getting Started",
    courses: [entry("beginner-workshop", "member", "Getting Started")],
  },
  {
    category: "LK-150",
    courses: [
      entry("lk-150-fun", "member", "LK-150"),
      entry("lk-150-quick-start", "free", "LK-150"),
    ],
  },
  {
    category: "Ribber",
    courses: [entry("ribber-basic-bootcamp", "member", "Ribber")],
  },
]);

describe("sortCourseCatalogSectionsForViewer", () => {
  it("moves sections with free courses before member-only sections for non-members", () => {
    const sorted = sortCourseCatalogSectionsForViewer(catalogSections, true);

    expect(sorted.map((section) => section.category)).toEqual([
      "LK-150",
      "Getting Started",
      "Ribber",
    ]);
    expect(sorted[0]?.courses.map((course) => course.slug)).toEqual([
      "lk-150-quick-start",
      "lk-150-fun",
    ]);
  });

  it("keeps original catalog section and card order for active members", () => {
    const sorted = sortCourseCatalogSectionsForViewer(catalogSections, false);

    expect(sorted.map((section) => section.category)).toEqual([
      "Getting Started",
      "LK-150",
      "Ribber",
    ]);
    expect(sorted[1]?.courses.map((course) => course.slug)).toEqual([
      "lk-150-fun",
      "lk-150-quick-start",
    ]);
  });

  it("preserves relative catalog order among free-containing sections", () => {
    const sections = withCourseCatalogOrders([
      {
        category: "A",
        courses: [entry("a-free", "free", "A"), entry("a-member", "member", "A")],
      },
      {
        category: "B",
        courses: [entry("b-member", "member", "B")],
      },
      {
        category: "C",
        courses: [entry("c-free", "free", "C")],
      },
    ]);

    const sorted = sortCourseCatalogSectionsForViewer(sections, true);
    expect(sorted.map((section) => section.category)).toEqual(["A", "C", "B"]);
  });
});

describe("preferCourseCatalogFreeFirst", () => {
  it("uses non-member ordering when Memberstack is missing/null", () => {
    expect(preferCourseCatalogFreeFirst(null)).toBe(true);
    expect(preferCourseCatalogFreeFirst(undefined)).toBe(true);
  });

  it("uses non-member ordering for logged-in users without active plans", () => {
    expect(
      preferCourseCatalogFreeFirst({
        data: {
          member: {
            id: "mem_nosub",
            planConnections: [],
          },
        },
      }),
    ).toBe(true);
  });

  it("uses member ordering only when hasMemberAccess is true", () => {
    expect(
      preferCourseCatalogFreeFirst({
        data: {
          member: {
            id: "mem_active",
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                status: "ACTIVE",
              },
            ],
          },
        },
      }),
    ).toBe(false);
  });
});
