import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import videosPublic from "../../data/videos-public.json";
import { helpHubMemberLessonCtaSpec } from "../helpHubMemberLessonCta";
import { getViewerAccessState } from "../memberAccess";
import { prepareHelpHubTipPage } from "./prepareTipPage";
import { resolveHelpHubPublicVideo } from "./publicVideo";

const here = dirname(fileURLToPath(import.meta.url));
const tipSource = readFileSync(
  join(here, "..", "..", "components", "help-hub", "HelpHubTipContent.astro"),
  "utf8",
);

const YARN_VIMEO_ID = "527759119";
const YARN_TITLE = "Yarn for Knitting Machines";

const lessons = [
  {
    id: 5002,
    slug: "tuck-on-the-lk150",
    title: "Tuck on the LK150",
    status: "published",
    summary: "How tuck works on the LK150.",
  },
];

const conesTip = {
  slug: "do-i-need-yarn-on-cones-for-machine-knitting",
  status: "published",
  question: "Do I need yarn on cones for machine knitting?",
  solutionText: "No. The yarn only needs to feed smoothly into the machine.",
  relatedLessons: [5002],
  publicVideoUrl: `https://vimeo.com/${YARN_VIMEO_ID}`,
  publicVideoTitle: YARN_TITLE,
};

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

function publicVideoMarkup(): string {
  const start = tipSource.indexOf("data-help-hub-public-video");
  const end = tipSource.indexOf("{hasTrySection");
  return tipSource.slice(start, end);
}

describe("Help Hub public video", () => {
  it("leaves an entry with no public video unchanged", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: conesTip.slug,
        question: conesTip.question,
        solutionText: conesTip.solutionText,
        relatedLessons: [5002],
      },
      lessons,
      videosPublic,
    );
    expect(resolveHelpHubPublicVideo({})).toBeNull();
    expect(view.publicVideo).toBeNull();
    expect(view.whyBody).toBe(conesTip.solutionText);
    expect(view.memberResourceCards).toEqual([
      expect.objectContaining({
        kind: "lesson",
        title: "Tuck on the LK150",
        href: expect.stringContaining("/lessons/tuck-on-the-lk150"),
      }),
    ]);
    expect(view.catalogVimeoEmbedUrl).toBe("");
  });

  it("renders the public video for visitors", () => {
    expect(viewerStateForPlan(null)).toBe("loggedOut");
    const view = prepareHelpHubTipPage(conesTip, lessons, videosPublic);
    expect(view.publicVideo).toEqual({
      vimeoId: YARN_VIMEO_ID,
      title: YARN_TITLE,
      embedUrl: `https://player.vimeo.com/video/${YARN_VIMEO_ID}`,
    });
  });

  it("renders the same public video for members", () => {
    expect(viewerStateForPlan(MEMBERSHIPS.membership.memberstackPlanId)).toBe("memberAccess");
    const view = prepareHelpHubTipPage(conesTip, lessons, videosPublic);
    expect(view.publicVideo?.vimeoId).toBe(YARN_VIMEO_ID);
    expect(view.publicVideo?.title).toBe(YARN_TITLE);
    expect(view.publicVideo?.embedUrl).toBe(`https://player.vimeo.com/video/${YARN_VIMEO_ID}`);
  });

  it("accepts a bare Vimeo ID and a player URL", () => {
    expect(resolveHelpHubPublicVideo({ publicVideoUrl: YARN_VIMEO_ID, publicVideoTitle: YARN_TITLE })?.vimeoId).toBe(
      YARN_VIMEO_ID,
    );
    expect(
      resolveHelpHubPublicVideo({
        publicVideoUrl: `https://player.vimeo.com/video/${YARN_VIMEO_ID}`,
        publicVideoTitle: YARN_TITLE,
      })?.embedUrl,
    ).toBe(`https://player.vimeo.com/video/${YARN_VIMEO_ID}`);
    expect(resolveHelpHubPublicVideo({ publicVideoUrl: "not-a-video", publicVideoTitle: YARN_TITLE })).toBeNull();
  });

  it("has no membership gate on the public video", () => {
    const markup = publicVideoMarkup();
    expect(markup).toContain("data-help-hub-public-video");
    expect(markup).toContain("publicVideo.title");
    expect(markup).toContain("publicVideo.embedUrl");
    expect(markup).toContain('class="kbm-kin-catalog-video help-hub-public-video__enlarge"');
    expect(markup).toContain("data-vimeo-id={publicVideo.vimeoId}");
    expect(markup).not.toContain("Become a Member");
    expect(markup).not.toContain("data-hh-lesson-gate");
    expect(markup).not.toContain("Member Lesson");
    expect(markup).not.toContain("memberstack");
    expect(markup).not.toContain("data-help-hub-lesson-open");
    const why = tipSource.indexOf("tuesday-tip__section--why");
    const video = tipSource.indexOf("data-help-hub-public-video");
    const tryThis = tipSource.indexOf("{hasTrySection");
    const lessons = tipSource.indexOf("data-help-hub-lessons");
    expect(why).toBeGreaterThan(-1);
    expect(video).toBeGreaterThan(why);
    expect(tryThis).toBeGreaterThan(video);
    expect(lessons).toBeGreaterThan(tryThis);
  });

  it("keeps member-only Related Lessons on the existing gate", () => {
    const withoutVideo = prepareHelpHubTipPage(
      {
        slug: conesTip.slug,
        relatedLessons: [5002],
        solutionText: conesTip.solutionText,
      },
      lessons,
      videosPublic,
    );
    const withVideo = prepareHelpHubTipPage(conesTip, lessons, videosPublic);
    expect(withVideo.memberResourceCards).toEqual(withoutVideo.memberResourceCards);
    expect(withVideo.memberLessonsSectionTitle).toBe("Member Lesson");
    const href = withVideo.memberResourceCards[0]!.href;
    expect(helpHubMemberLessonCtaSpec(viewerStateForPlan(null), href).buttons[0]).toEqual(
      expect.objectContaining({ text: "Become a Member", action: "membership" }),
    );
    expect(helpHubMemberLessonCtaSpec(viewerStateForPlan(MEMBERSHIPS.membership.memberstackPlanId), href).buttons[0]).toEqual(
      expect.objectContaining({ text: "Watch the full lesson", action: "lesson", href }),
    );
    expect(tipSource).toContain("data-hh-lesson-gate");
    expect(tipSource).toContain("data-help-hub-lesson-open");
  });
});
