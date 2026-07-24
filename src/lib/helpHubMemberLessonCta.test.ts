import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import { getViewerAccessState } from "./memberAccess";
import {
  HELP_HUB_MEMBER_LESSON_LOCKED_STATUS,
  HELP_HUB_MEMBER_LESSON_LOCKED_SUPPORT,
  helpHubMemberLessonCtaSpec,
} from "./helpHubMemberLessonCta";

const here = dirname(fileURLToPath(import.meta.url));
const helpHubPageSource = readFileSync(
  join(here, "..", "pages", "help-hub", "[slug].astro"),
  "utf8",
);

const LESSON_HREF = "/lessons/tuck-on-the-lk150?from=help-hub&hub=how-do-i-knit-tuck-stitch-on-my-lk150";

function viewerStateForPlan(planId: string | null) {
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

describe("helpHubMemberLessonCtaSpec", () => {
  it("unresolved state has no CTA or locked copy", () => {
    expect(helpHubMemberLessonCtaSpec(null, LESSON_HREF)).toEqual({
      buttons: [],
      showMembershipNote: false,
    });
  });

  it("memberAccess shows the lesson link and membership note only", () => {
    const state = viewerStateForPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(state).toBe("memberAccess");

    expect(helpHubMemberLessonCtaSpec(state, LESSON_HREF)).toEqual({
      buttons: [
        {
          href: LESSON_HREF,
          text: "Watch the full lesson",
          action: "lesson",
          variant: "primary",
        },
      ],
      showMembershipNote: true,
    });
  });

  it("loggedOut shows locked status, membership primary, and login secondary", () => {
    const state = viewerStateForPlan(null);
    expect(state).toBe("loggedOut");

    const spec = helpHubMemberLessonCtaSpec(state, LESSON_HREF);
    expect(spec.lockedStatus).toBe(HELP_HUB_MEMBER_LESSON_LOCKED_STATUS);
    expect(spec.lockedSupport).toBeUndefined();
    expect(spec.showMembershipNote).toBe(false);
    expect(spec.buttons).toEqual([
      {
        href: "/membership",
        text: "Become a Member",
        action: "membership",
        variant: "primary",
      },
      {
        href: "#",
        text: "Already a member? Log in",
        action: "login",
        variant: "secondary",
      },
    ]);
  });

  it("loggedInNoAccess shows locked copy and one Become a Member button", () => {
    const state = getViewerAccessState({
      data: { id: "ms_nosub", planConnections: [] },
    });
    expect(state).toBe("loggedInNoAccess");

    const spec = helpHubMemberLessonCtaSpec(state, LESSON_HREF);
    expect(spec).toEqual({
      lockedStatus: HELP_HUB_MEMBER_LESSON_LOCKED_STATUS,
      lockedSupport: HELP_HUB_MEMBER_LESSON_LOCKED_SUPPORT,
      buttons: [
        {
          href: "/membership",
          text: "Become a Member",
          action: "membership",
          variant: "primary",
        },
      ],
      showMembershipNote: false,
    });
  });

  it("beta-only members get the logged-in non-member CTA (no lesson unlock)", () => {
    const state = viewerStateForPlan(MEMBERSHIPS.beta.memberstackPlanId);
    expect(state).toBe("loggedInNoAccess");

    expect(helpHubMemberLessonCtaSpec(state, LESSON_HREF)).toEqual({
      lockedStatus: HELP_HUB_MEMBER_LESSON_LOCKED_STATUS,
      lockedSupport: HELP_HUB_MEMBER_LESSON_LOCKED_SUPPORT,
      buttons: [
        {
          href: "/membership",
          text: "Become a Member",
          action: "membership",
          variant: "primary",
        },
      ],
      showMembershipNote: false,
    });
  });
});

describe("Help Hub Member Lesson card markup", () => {
  it("uses one CTA mount per card instead of three hidden state links", () => {
    expect(helpHubPageSource).toContain("data-hh-lesson-cta");
    expect(helpHubPageSource).toContain("data-lesson-href={lessonHref}");
    expect(helpHubPageSource).not.toContain("data-hh-lesson-state");
  });

  it("keeps the membership note hidden until member access is confirmed", () => {
    expect(helpHubPageSource).toContain('data-hh-lesson-note hidden');
  });
});
