import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { KIN_TAITEXMA_160_COURSE_SLUG, LEGACY_SK840_COURSE_SLUG } from "../../config/legacyCourseEntitlements";
import { canAccessCourse } from "../courseAccess";
import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { classifyHomeStudyCreditEvidence } from "./homeStudyCreditEvidence";
import {
  isVerifiedHomeStudyLibraryPurchase,
  verifiedHomeStudyCourseIdsFromRows,
} from "./homeStudyPurchaseEntitlement";
import {
  loadHomeStudyPurchasesForMemberstackRecord,
  playbackCourseIdsFromLookup,
} from "./homeStudyPurchaseAccess";
import {
  buildHomeStudyCourseAccessReport,
  loadHomeStudySitePlayerInventory,
} from "./homeStudyCourseAccessReport";
import { accountCoursesForMember } from "./accountMyCourses";
import type { LegacyMemberDetailRow } from "../watson/memberDetail";

const paidEvidence = {
  transactionType: "Home Study Courses",
  dollarAmount: 25,
  authorizeId: "auth-1",
  transactionGuid: "guid-1",
};

const nullDollarEvidence = {
  transactionType: "Home Study Courses",
  dollarAmount: null,
  authorizeId: "auth-null",
  transactionGuid: "guid-null",
};

function library(courseId: number, subscriberfree: number, creditId: number) {
  return {
    homestudy_courseid_fk: courseId,
    subscriberfree,
    credit_id_fk: creditId,
  };
}

function member(memberid: string): LegacyMemberDetailRow {
  return { memberid, email: "former@example.com" } as LegacyMemberDetailRow;
}

describe("Home Study credit evidence", () => {
  it("verifies a positive Home Study amount", () => {
    expect(classifyHomeStudyCreditEvidence(paidEvidence)).toBe("verified_positive_amount");
  });

  it("verifies the NULL-dollar rows that still have both payment ids", () => {
    expect(classifyHomeStudyCreditEvidence(nullDollarEvidence)).toBe(
      "verified_null_amount_with_payment_ids",
    );
  });

  it("does not verify a zero amount, a missing credit, or a NULL amount without both ids", () => {
    expect(
      classifyHomeStudyCreditEvidence({
        transactionType: "Home Study Courses",
        dollarAmount: 0,
        authorizeId: "auth",
        transactionGuid: "guid",
      }),
    ).toBe("excluded_zero_amount");
    expect(classifyHomeStudyCreditEvidence(null)).toBe("excluded_unmatched");
    expect(
      classifyHomeStudyCreditEvidence({
        transactionType: "Home Study Courses",
        dollarAmount: null,
        authorizeId: "auth",
        transactionGuid: "",
      }),
    ).toBe("excluded_null_amount_without_payment_ids");
  });
});

describe("Home Study library entitlement", () => {
  it("refuses subscriber-free rows even when the credit evidence is paid", () => {
    expect(isVerifiedHomeStudyLibraryPurchase(library(49, 1, 0), null)).toBe(false);
    expect(isVerifiedHomeStudyLibraryPurchase(library(49, 1, 88), paidEvidence)).toBe(false);
  });

  it("refuses a positive credit id that has no evidence, a zero amount, or no credit row", () => {
    expect(isVerifiedHomeStudyLibraryPurchase(library(86, 0, 10), null)).toBe(false);
    expect(
      isVerifiedHomeStudyLibraryPurchase(library(86, 0, 10), {
        transactionType: "Home Study Courses",
        dollarAmount: 0,
        authorizeId: "auth",
        transactionGuid: "guid",
      }),
    ).toBe(false);
    expect(isVerifiedHomeStudyLibraryPurchase(library(12, 0, 0), paidEvidence)).toBe(false);
  });

  it("accepts positive-amount and NULL-dollar payment evidence on subscriberfree 0", () => {
    expect(isVerifiedHomeStudyLibraryPurchase(library(86, 0, 10), paidEvidence)).toBe(true);
    expect(isVerifiedHomeStudyLibraryPurchase(library(111, 0, 11), nullDollarEvidence)).toBe(true);
    expect(
      verifiedHomeStudyCourseIdsFromRows([
        { library: library(49, 1, 0), evidence: null },
        { library: library(86, 0, 10), evidence: paidEvidence },
        { library: library(7, 0, 12), evidence: nullDollarEvidence },
      ]),
    ).toEqual([7, 86]);
  });
});

describe("authenticated legacy identity", () => {
  const record = { auth: { email: "former@example.com" }, id: "mem_real" };

  it("grants nothing when the email link is missing or ambiguous", async () => {
    const missing = await loadHomeStudyPurchasesForMemberstackRecord(record, async () => []);
    expect(missing.identity).toBe("none");
    expect(missing.verifiedCourseIds).toEqual([]);

    const ambiguous = await loadHomeStudyPurchasesForMemberstackRecord(record, async (sql) => {
      if (String(sql).includes("legacy_members")) return [member("A"), member("B")];
      return [];
    });
    expect(ambiguous.identity).toBe("ambiguous");
    expect(ambiguous.accountCourses).toEqual([]);
  });

  it("uses the linked legacy member id and ignores a caller-supplied course id", async () => {
    const lookup = await loadHomeStudyPurchasesForMemberstackRecord(
      { ...record, courseId: 49, memberid: "SPOOF" },
      async (sql) => {
        if (String(sql).includes("legacy_members")) return [member("LEG-1")];
        expect(String(sql)).toContain("memberid_fk = $1");
        return [
          {
            homestudy_courseid_fk: 86,
            subscriberfree: 0,
            credit_id_fk: 10,
            transaction_type: "Home Study Courses",
            dollar_amount: "49.99",
            authorize_id: "auth",
            transaction_guid: "guid",
          },
          {
            homestudy_courseid_fk: 49,
            subscriberfree: 1,
            credit_id_fk: 0,
            transaction_type: null,
            dollar_amount: null,
            authorize_id: null,
            transaction_guid: null,
          },
        ];
      },
    );
    expect(lookup.identity).toBe("unique");
    expect(lookup.verifiedCourseIds).toEqual([86]);
    expect(playbackCourseIdsFromLookup(lookup)).toEqual([86]);
    expect(lookup.accountCourses.find((course) => course.courseId === 49)).toBeUndefined();
  });
});

describe("course page, lessons, and catalog videos", () => {
  const expired = { data: { id: "mem_expired", planConnections: [] } };

  it("lets an expired member open a mapped purchased course and its lesson gate", () => {
    expect(
      canAccessCourse("purchase", expired, {
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        verifiedHomeStudyCourseIds: [86],
      }),
    ).toBe(true);
    expect(
      canAccessCourse("member", expired, {
        courseSlug: LEGACY_SK840_COURSE_SLUG,
        verifiedHomeStudyCourseIds: [111],
      }),
    ).toBe(true);
    const gate = readFileSync(resolve("src/scripts/kinCourseAccessGate.ts"), "utf8");
    expect(gate).toContain("ensureHomeStudyPurchaseContext");
    expect(gate).toContain("verifiedHomeStudyCourseIds");
  });

  it("does not open catalog member videos from a Home Study purchase", () => {
    expect(catalogVideoPlaybackAccess({ access_level: "member" })).toBe("member");
    const embed = readFileSync(resolve("netlify/functions/catalog-video-embed.ts"), "utf8");
    expect(embed).toContain("hasMemberAccess");
    expect(embed).not.toContain("verifiedHomeStudyCourseIds");
  });

  it("still opens every course for an active member without a purchase list", () => {
    const member = {
      data: {
        id: "mem_active",
        planConnections: [{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }],
      },
    };
    expect(canAccessCourse("member", member, { courseSlug: "ribber-basic-bootcamp" })).toBe(true);
    expect(
      canAccessCourse("purchase", member, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
  });
});

describe("account courses", () => {
  it("shows a mapped purchase with a link and an unmapped purchase without one", () => {
    const courses = accountCoursesForMember(null, [
      {
        courseId: 86,
        title: "Taitexma TH/TR-160: Getting Started",
        href: "/courses/86",
        availability: "available",
      },
      {
        courseId: 49,
        title: "Home Study course 49",
        href: null,
        availability: "not_on_site",
      },
    ]);
    expect(courses[0]).toMatchObject({
      slug: KIN_TAITEXMA_160_COURSE_SLUG,
      href: "/courses/86",
      availability: "available",
    });
    expect(courses[1]).toEqual({
      slug: "49",
      title: "Home Study course 49",
      href: null,
      availability: "not_on_site",
    });
    expect(courses.some((course) => course.href?.includes("download"))).toBe(false);
  });
});

describe("Home Study course availability report", () => {
  it("maps only courses 86 and 111 and does not offer downloads", () => {
    const players = loadHomeStudySitePlayerInventory();
    const report = buildHomeStudyCourseAccessReport({
      players,
      counts: [
        { courseId: 49, subscriberFreeRows: 1, candidateRows: 0, verifiedRows: 0 },
        { courseId: 86, subscriberFreeRows: 0, candidateRows: 4, verifiedRows: 1 },
        { courseId: 7, subscriberFreeRows: 2, candidateRows: 3, verifiedRows: 0 },
      ],
    });
    const course86 = report.players.find((row) => row.sitePlayerId === 86);
    const course111 = report.players.find((row) => row.sitePlayerId === 111);
    const course49 = report.players.find((row) => row.homeStudyCourseId === 49);
    expect(course86?.mapping).toBe("verified_site_product");
    expect(course86?.playback).toBe("available");
    expect(course86?.verifiedPurchaseRows).toBe(1);
    expect(course111?.mapping).toBe("verified_site_product");
    expect(course111?.playback).toBe("available");
    expect(course49?.mapping).toBe("unresolved_title_conflict");
    expect(course49?.playback).toBe("not_available");
    const unmappedPlayer = report.players.find(
      (row) => row.mapping === "unmapped_player" && row.sitePlayerId != null,
    );
    expect(unmappedPlayer?.playback).toBe("not_available");
    expect(unmappedPlayer?.needed.toLowerCase()).toContain("do not promise a download");
    expect(report.unmappedLibraryCourses.find((row) => row.homeStudyCourseId === 7)?.playback).toBe(
      "not_available",
    );
    const text = JSON.stringify(report);
    expect(text.toLowerCase()).not.toContain("download this");
    expect(text).not.toContain("Learn DesignaKnit");
  });
});
