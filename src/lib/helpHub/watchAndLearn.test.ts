import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import { prepareHelpHubTipPage } from "./prepareTipPage";
import { resolveHelpHubWatchAndLearn } from "./watchAndLearn";

const CUT_SEW_SLUG = "cut-and-sew-shaping";
const INTRO_DESCRIPTION =
  "Learn the basics of securing and cutting knitted fabric before trying the technique on your own project.";
const STABILIZER_DESCRIPTION =
  "Discover how stabilizer can help you achieve clean, professional results when cutting knitted fabric.";

const watchAndLearn = [
  { contentId: 249, description: INTRO_DESCRIPTION },
  { contentId: 857, description: STABILIZER_DESCRIPTION },
];

describe("resolveHelpHubWatchAndLearn", () => {
  it("uses catalog titles and playback access for the Cut 'n Sew videos", () => {
    const videos = resolveHelpHubWatchAndLearn(watchAndLearn, videosPublic, {
      tipSlug: CUT_SEW_SLUG,
    });

    expect(videos).toEqual([
      {
        contentId: 249,
        title: "Introduction to Cut and Sew",
        description: INTRO_DESCRIPTION,
        href: "/videos/249?from=help-hub&hub=cut-and-sew-shaping",
        access: "open",
        accessLabel: "Free",
      },
      {
        contentId: 857,
        title: "Stabilizer for Cut 'n Sew Excellence",
        description: STABILIZER_DESCRIPTION,
        href: "/videos/857?from=help-hub&hub=cut-and-sew-shaping",
        access: "member",
        accessLabel: "Members only",
      },
    ]);
    expect(JSON.stringify(videos)).not.toMatch(/151819909|280094859/);
  });

  it("returns nothing when the tip has no Watch and Learn videos", () => {
    expect(resolveHelpHubWatchAndLearn(undefined, videosPublic)).toEqual([]);
  });
});

describe("prepareHelpHubTipPage Watch and Learn", () => {
  it("keeps the section off tips that do not list videos", () => {
    const view = prepareHelpHubTipPage(
      { slug: "sandwich-neckband-finish", trySteps: ["Knit the first half of the band"] },
      [],
      videosPublic,
    );
    expect(view.watchAndLearnVideos).toEqual([]);
  });

  it("resolves the Cut 'n Sew videos without embedding them", () => {
    const view = prepareHelpHubTipPage(
      {
        slug: CUT_SEW_SLUG,
        tryThisTitle: "Try This",
        trySteps: ["Use an unneeded swatch"],
        watchAndLearn,
      },
      [],
      videosPublic,
    );
    expect(view.watchAndLearnVideos.map((video) => video.contentId)).toEqual([249, 857]);
    expect(view.watchAndLearnVideos.map((video) => video.accessLabel)).toEqual([
      "Free",
      "Members only",
    ]);
    expect(JSON.stringify(view.watchAndLearnVideos)).not.toContain("player.vimeo.com");
  });
});

describe("Help Hub Watch and Learn placement", () => {
  it("renders after Try This and only links member videos through the lesson gate", () => {
    const tipSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../components/help-hub/HelpHubTipContent.astro"),
      "utf8",
    );
    const tryThis = tipSource.indexOf("tuesday-tip__try-section");
    const watch = tipSource.indexOf('data-help-hub-watch');
    const relatedTool = tipSource.indexOf("<HelpHubRelatedTool");
    expect(tryThis).toBeGreaterThan(-1);
    expect(watch).toBeGreaterThan(tryThis);
    expect(relatedTool).toBeGreaterThan(watch);
    const watchBlock = tipSource.slice(watch, relatedTool);
    expect(watchBlock).toContain("Watch and Learn");
    expect(watchBlock).toContain("video.accessLabel");
    expect(watchBlock).toContain('video.access === "open"');
    expect(watchBlock).toContain("data-help-hub-lesson-open");
    expect(watchBlock).not.toContain("player.vimeo.com");
    expect(watchBlock).not.toContain("iframe");
  });
});
