import { afterEach, describe, expect, it, vi } from "vitest";
import tipJson from "../../data/tip-of-the-week.json";
import { tipIsPubliclyFeatured } from "./schedule";
import {
  loadPublicTipOfTheWeekPage,
  loadTipOfTheWeekPreview,
} from "./publicPage";

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    getTipOfTheWeekById: vi.fn(),
    getPublicFeaturedTip: vi.fn(async () => null),
  };
});

import { getTipOfTheWeekById } from "./store";

describe("loadPublicTipOfTheWeekPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getTipOfTheWeekById).mockReset();
  });

  it("uses explicit JSON only when TIP_OF_THE_WEEK_DEV_JSON=true", async () => {
    vi.stubEnv("TIP_OF_THE_WEEK_DEV_JSON", "true");
    const during = await loadPublicTipOfTheWeekPage(
      new Date("2026-08-10T18:00:00.000Z"),
    );
    expect(during.kind).toBe("featured");
    if (during.kind === "featured") {
      expect(during.model.source).toBe("dev-json");
      expect(during.model.tip.tipId).toBe(tipJson.tipId);
      expect(during.model.tip.availableThrough).toBe(tipJson.availableThrough);
      expect(during.model.availabilityFooter).toContain(
        during.model.availableThroughDisplay,
      );
      expect(during.model.isPlayable).toBe(true);
    }

    const before = await loadPublicTipOfTheWeekPage(
      new Date("2026-08-07T18:00:00.000Z"),
    );
    expect(before.kind).toBe("coming_soon");

    const after = await loadPublicTipOfTheWeekPage(
      new Date("2026-08-15T18:00:00.000Z"),
    );
    expect(after.kind).toBe("coming_soon");
  });

  it("does not treat draft JSON-shaped records as public without schedule window", () => {
    expect(
      tipIsPubliclyFeatured(
        {
          status: "draft",
          availableFrom: tipJson.availableFrom,
          availableThrough: tipJson.availableThrough,
        },
        "2026-08-10",
      ),
    ).toBe(false);
  });

  it("loads a scheduled tip for Watson preview without making it public", async () => {
    vi.mocked(getTipOfTheWeekById).mockResolvedValue({
      id: "tip-row-1",
      tipId: "taming-the-curl-2026-08",
      title: "Tame the Dreaded Stockinette Curl",
      intro: "Preview intro",
      videoContentId: "339",
      availableFrom: "2026-08-08",
      availableThrough: "2026-08-14",
      status: "scheduled",
      availabilityNotice: "Free to watch this week",
      availabilityFooterTemplate:
        "This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.",
      tryCopy: "Try it",
      sueTipCopy: "Sue tip",
      learnPoints: ["A"],
      relatedLinks: [{ label: "Wet Blocking", href: "/videos/456" }],
      eyebrow: "TIP OF THE WEEK",
      createdAt: "",
      updatedAt: "",
    });

    const preview = await loadTipOfTheWeekPreview("tip-row-1");
    expect(preview.kind).toBe("featured");
    if (preview.kind === "featured") {
      expect(preview.model.isPreview).toBe(true);
      expect(preview.model.source).toBe("watson-preview");
      expect(preview.model.tip.status).toBe("scheduled");
    }

    const publicPage = await loadPublicTipOfTheWeekPage(
      new Date("2026-08-04T18:00:00.000Z"),
    );
    expect(publicPage.kind).toBe("coming_soon");
  });
});
