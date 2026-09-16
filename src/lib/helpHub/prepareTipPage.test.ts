import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import { prepareHelpHubTipPage } from "./prepareTipPage";
import { helpHubMemberLessonCtaSpec } from "../helpHubMemberLessonCta";
import { getViewerAccessState } from "../memberAccess";
import { MEMBERSHIPS } from "../../config/memberships";

const VIMEO_1027 = "502818680";

const lessons = [
  {
    id: 5002,
    slug: "tuck-on-the-lk150",
    title: "Tuck on the LK150",
    status: "published",
    summary: "How tuck works on the LK150.",
  },
];

describe("prepareHelpHubTipPage member resources", () => {
  it("links eligible members to /videos/1027 and never includes Vimeo ID 502818680", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: "every-other-needle-swatch",
        status: "published",
        question: "I’m knitting over every other needle. How do I swatch?",
        relatedLibraryVideos: [{ type: "library", contentId: 1027 }],
      },
      lessons,
      videosPublic,
    );
    expect(view.memberResourceCards).toEqual([
      expect.objectContaining({
        kind: "library",
        title: "Every other Needle Knitting",
        href: "/videos/1027?from=help-hub&hub=every-other-needle-swatch",
      }),
    ]);
    expect(view.catalogVimeoEmbedUrl).toBe("");
    expect(JSON.stringify(view)).not.toContain(VIMEO_1027);
    const memberState = getViewerAccessState({
      data: {
        id: "ms_member",
        planConnections: [{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }],
      },
    });
    const spec = helpHubMemberLessonCtaSpec(memberState, view.memberResourceCards[0]!.href);
    expect(spec.buttons[0]?.href).toContain("/videos/1027");
    expect(spec.buttons[0]?.action).toBe("lesson");
  });

  it("does not embed a member catalog video when videoId is 1027", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: "every-other-needle-swatch",
        videoId: 1027,
      },
      lessons,
      videosPublic,
    );
    expect(view.catalogVimeoEmbedUrl).toBe("");
    expect(JSON.stringify(view)).not.toContain(VIMEO_1027);
  });

  it("keeps existing member-lesson cards and public hero media", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: "how-do-i-knit-tuck-stitch-on-my-lk150",
        status: "published",
        relatedLessons: [5002],
        mediaType: "image",
        mediaUrl: "/images/help-hub/tuck-example.jpg",
        solutionText: "Tuck stitch on the LK150",
      },
      lessons,
      videosPublic,
    );
    expect(view.memberResourceCards.some((card) => card.href.includes("/lessons/tuck-on-the-lk150"))).toBe(
      true,
    );
    expect(view.mediaType).toBe("image");
    expect(view.mediaUrl).toBe("/images/help-hub/tuck-example.jpg");
    expect(view.whyBody).toBe("Tuck stitch on the LK150");
  });

  it("still uses legacy bridge text when solutionText is empty", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: "measure-gauge-on-a-knitting-machine",
        status: "draft",
        bridge: "Most knitters are taught to measure 4 inches.",
      },
      lessons,
      videosPublic,
    );
    expect(view.whyBody).toBe("Most knitters are taught to measure 4 inches.");
  });
});

describe("Help Hub membership CTA for library resources", () => {
  const href = "/videos/1027?from=help-hub&hub=every-other-needle-swatch";

  it("shows membership/login CTAs for logged-out visitors", () => {
    const spec = helpHubMemberLessonCtaSpec("loggedOut", href);
    expect(spec.buttons.map((b) => b.action)).toEqual(["membership", "login"]);
    expect(spec.buttons.some((b) => b.href === href)).toBe(false);
  });

  it("shows membership CTA for logged-in non-members", () => {
    const spec = helpHubMemberLessonCtaSpec("loggedInNoAccess", href);
    expect(spec.buttons.map((b) => b.action)).toEqual(["membership"]);
  });
});
