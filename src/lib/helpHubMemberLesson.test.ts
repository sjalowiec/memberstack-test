import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import helpHubData from "../data/help-hub.json";
import lessonsData from "../data/lessons.json";
import {
  getViewerAccessState,
  hasMemberAccess,
  type ViewerAccessState,
} from "./memberAccess";
import {
  lessonRequiresMemberAccess,
  listPublicHelpHubMemberLessonCards,
  resolveHelpHubRelatedLessons,
} from "./helpHubMemberLesson";
import { helpHubTipIsPublic } from "./helpHubPublic";

const helpHubTips = Array.isArray(helpHubData) ? helpHubData : [];
const lessons = Array.isArray(lessonsData) ? lessonsData : [];

function viewerStateForPlan(planId: string | null): ViewerAccessState {
  const payload =
    planId === null
      ? { data: null }
      : {
          data: {
            id: "ms_test",
            planConnections: [{ planId, status: "ACTIVE", active: true }],
          },
        };
  return getViewerAccessState(payload);
}

describe("memberAccess viewer states for Help Hub Member Lessons", () => {
  it("memberAccess: logged-in member with an allowed plan", () => {
    expect(viewerStateForPlan(MEMBERSHIPS.membership.memberstackPlanId)).toBe("memberAccess");
    expect(hasMemberAccess({
      data: {
        id: "ms_member",
        planConnections: [{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }],
      },
    })).toBe(true);
  });

  it("loggedInNoAccess: logged-in user without a qualifying plan", () => {
    expect(
      getViewerAccessState({
        data: {
          id: "ms_nosub",
          planConnections: [],
        },
      }),
    ).toBe("loggedInNoAccess");
  });

  it("loggedOut: no member record", () => {
    expect(getViewerAccessState(null)).toBe("loggedOut");
    expect(getViewerAccessState({ data: null })).toBe("loggedOut");
  });

  it("memberAccess: active beta plan counts as member access", () => {
    expect(viewerStateForPlan(MEMBERSHIPS.beta.memberstackPlanId)).toBe("memberAccess");
    expect(hasMemberAccess({
      data: {
        id: "ms_beta",
        planConnections: [{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }],
      },
    })).toBe(true);
  });
});

describe("listPublicHelpHubMemberLessonCards", () => {
  it("lists every published Help Hub tip that renders a Member Lesson card", () => {
    const cards = listPublicHelpHubMemberLessonCards(helpHubTips, lessons);
    const tipSlugs = [...new Set(cards.map((c) => c.tipSlug))].sort();

    expect(tipSlugs).toEqual([
      "cut-and-sew-shaping",
      "how-do-i-knit-tuck-stitch-on-my-lk150",
      "not-enough-needles",
      "sandwich-neckband-finish",
      "slip-stitch-on-the-lk150",
    ]);
  });

  it("does not include draft Help Hub tips", () => {
    const cards = listPublicHelpHubMemberLessonCards(helpHubTips, lessons);
    expect(cards.some((c) => c.tipSlug === "measure-gauge-on-a-knitting-machine")).toBe(false);
  });
});

describe("lessonRequiresMemberAccess", () => {
  it("requires access for lessons linked from public Help Hub tips even when access is free", () => {
    const stabilizer = lessons.find(
      (l) => l.slug === "use-stabilizer-for-clean-confident-cut-n-sew-edges",
    );
    expect(stabilizer?.access).toBe("free");
    expect(lessonRequiresMemberAccess(stabilizer!, helpHubTips, lessons)).toBe(true);
  });

  it("requires access for lessons with access member or missing access", () => {
    const colorwork = lessons.find((l) => l.slug === "colorwork-first-steps");
    const tuck = lessons.find((l) => l.slug === "tuck-on-the-lk150");
    expect(lessonRequiresMemberAccess(colorwork!, helpHubTips, lessons)).toBe(true);
    expect(lessonRequiresMemberAccess(tuck!, helpHubTips, lessons)).toBe(true);
  });

  it("does not require access for standalone free lessons not linked from public Help Hub", () => {
    const icord = lessons.find((l) => l.slug === "i-cord-seam");
    expect(icord?.access).toBe("free");
    expect(lessonRequiresMemberAccess(icord!, helpHubTips, lessons)).toBe(false);
  });
});

describe("resolveHelpHubRelatedLessons", () => {
  it("resolves numeric lesson ids used by published Help Hub tips", () => {
    const tuckTip = helpHubTips.find(
      (t) => t.slug === "how-do-i-knit-tuck-stitch-on-my-lk150",
    );
    const resolved = resolveHelpHubRelatedLessons(tuckTip?.relatedLessons, lessons);
    expect(resolved.map((l) => l.slug)).toEqual(["tuck-on-the-lk150"]);
  });
});

describe("public Help Hub content remains available", () => {
  it("published tips with member lessons stay public on the Help Hub", () => {
    const publishedWithLessons = helpHubTips.filter(
      (t) =>
        helpHubTipIsPublic(t) &&
        Array.isArray(t.relatedLessons) &&
        t.relatedLessons.length > 0,
    );
    expect(publishedWithLessons.length).toBeGreaterThan(0);
    publishedWithLessons.forEach((tip) => {
      expect(helpHubTipIsPublic(tip)).toBe(true);
    });
  });
});
