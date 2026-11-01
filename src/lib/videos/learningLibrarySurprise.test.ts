import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeVideoCatalog } from "./videoCatalogStore";
import {
  anotherSurpriseVideo,
  assembleLearningLibrarySurpriseVideos,
  eligibleSurpriseVideos,
  learningLibrarySurpriseRefs,
  learningLibraryVideoHref,
  parseVideoSurpriseSession,
  sessionForEligiblePool,
  shortVideoDescription,
  startSurpriseVideo,
  videoSurpriseAccessMode,
  videoSurprisePanel,
} from "./learningLibrarySurprise";

const pageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../pages/videos/index.astro"),
  "utf8",
);

function video(overrides: Record<string, unknown> = {}) {
  return {
    content_id: 101,
    slug: "library-video",
    title: "Library video",
    description: "A short catalog description.",
    access_level: "public",
    vimeo_id: 555,
    posterUrl: "https://i.vimeocdn.com/video/example.jpg",
    status: "published",
    ...overrides,
  };
}

describe("learningLibrarySurpriseRefs", () => {
  it("includes a published admin video that is not in the bundled catalog", () => {
    const merged = mergeVideoCatalog(
      [video({ content_id: 101, title: "Bundled" })],
      [
        {
          contentId: "9001",
          deleted: false,
          sortOrder: 1,
          document: video({
            content_id: 9001,
            slug: "admin-published",
            title: "Fresh from admin",
            description: "Published through the video admin.",
            access_level: "member",
            vimeo_id: 900100,
          }),
        },
        {
          contentId: "9002",
          deleted: false,
          sortOrder: 2,
          document: video({
            content_id: 9002,
            title: "Still a draft",
            status: "draft",
            vimeo_id: 900200,
          }),
        },
        {
          contentId: "101",
          deleted: true,
          sortOrder: 0,
          document: null,
        },
      ],
    );

    expect(learningLibrarySurpriseRefs(merged).map((ref) => ref.id)).toEqual(["9001"]);
  });

  it("keeps published standalone videos and drops course lessons, clips, and unavailable rows", () => {
    const refs = learningLibrarySurpriseRefs([
      video({ content_id: 1, title: "Open lesson", access_level: "open" }),
      video({ content_id: 2, title: "Free lesson", access_level: "free" }),
      video({ content_id: 3, title: "Public lesson", access_level: "public" }),
      video({
        content_id: 4,
        title: "Tuesday tip",
        access_level: "member",
        isTipOfWeek: true,
      }),
      video({ content_id: 5, title: "Members", access_level: "member" }),
      (() => {
        const omitted = video({ content_id: 6, title: "Omitted access" });
        delete omitted.access_level;
        return omitted;
      })(),
      video({ content_id: 7, title: "Draft", status: "draft" }),
      video({ content_id: 8, title: "Archived", status: "archived" }),
      video({ content_id: "249-1", title: "Clip", videoType: "clip", sourceVideoId: "249" }),
      video({ content_id: 10, title: "No picture id", vimeo_id: "" }),
      video({ content_id: "", title: "No id" }),
      video({ content_id: 12, title: "   " }),
      { type: "video", vimeoId: "123456", title: "Course only lesson" },
    ]);

    expect(refs).toEqual([
      { id: "1", access: "open" },
      { id: "2", access: "open" },
      { id: "3", access: "open" },
      { id: "4", access: "open" },
      { id: "5", access: "member" },
      { id: "6", access: "member" },
    ]);
  });
});

describe("surprise access", () => {
  const videos = assembleLearningLibrarySurpriseVideos(
    [
      { id: "1", access: "open" },
      { id: "5", access: "member" },
    ],
    [
      video({ content_id: 1, title: "Open lesson" }),
      video({ content_id: 5, title: "Members", access_level: "member" }),
    ],
  );

  it("shows member videos only when the visitor can watch them", () => {
    expect(eligibleSurpriseVideos(videos, "guest").map((item) => item.id)).toEqual(["1"]);
    expect(eligibleSurpriseVideos(videos, "checking").map((item) => item.id)).toEqual(["1"]);
    expect(eligibleSurpriseVideos(videos, "member").map((item) => item.id)).toEqual(["1", "5"]);
  });

  it("uses the same membership signal as the rest of the library", () => {
    expect(videoSurpriseAccessMode({ hasMemberAccess: null, previewForceMember: null })).toBe("checking");
    expect(videoSurpriseAccessMode({ hasMemberAccess: false })).toBe("guest");
    expect(videoSurpriseAccessMode({ hasMemberAccess: true })).toBe("member");
    expect(videoSurpriseAccessMode({ hasMemberAccess: true, previewForceMember: false })).toBe("guest");
  });

  it("waits instead of saying the library is empty while membership is unresolved", () => {
    expect(videoSurprisePanel({ access: "checking", openCount: 0, memberOnlyCount: 3 })).toBe("checking");
    expect(videoSurprisePanel({ access: "guest", openCount: 0, memberOnlyCount: 3 })).toBe("empty");
    expect(videoSurprisePanel({ access: "member", openCount: 0, memberOnlyCount: 3 })).toBe("ready");
    expect(videoSurprisePanel({ access: "checking", openCount: 2, memberOnlyCount: 3 })).toBe("ready");
  });

  it("opens the existing video page and does not autoplay", () => {
    expect(learningLibraryVideoHref("9001")).toBe("/videos/9001");
    expect(learningLibraryVideoHref("9001")).not.toContain("autoplay");
    expect(videos[0]?.href).toBe("/videos/1");
    expect(videos[0]?.description).toBe("A short catalog description.");
    expect(videos[0]?.posterUrl).toContain("https://i.vimeocdn.com/");
  });

  it("shortens a long description without inventing new copy", () => {
    const long = "Learn the setup. ".repeat(40).trim();
    const short = shortVideoDescription(long, 80);
    expect(short.endsWith("…")).toBe(true);
    expect(short.length).toBeLessThanOrEqual(81);
    expect(long.startsWith(short.slice(0, -1))).toBe(true);
  });
});

describe("surprise session", () => {
  it("does not repeat a video until the rest of the eligible pool has been shown", () => {
    const ids = ["a", "b", "c"];
    let session = startSurpriseVideo(ids, [], () => 0);
    expect(session?.currentId).toBe("a");
    const shown = [session?.currentId];
    for (let step = 0; step < 4; step += 1) {
      expect(session).not.toBeNull();
      if (!session) return;
      const next = anotherSurpriseVideo(ids, session, () => 0);
      expect(next).not.toBeNull();
      if (!next) return;
      expect(next.currentId).not.toBe(session.currentId);
      shown.push(next.currentId);
      session = next;
    }
    expect(new Set(shown.slice(0, 3)).size).toBe(3);
  });

  it("stays on the only video instead of pretending there is another", () => {
    const session = startSurpriseVideo(["only"], [], () => 0);
    expect(session).toEqual({ currentId: "only", seenIds: ["only"] });
    expect(anotherSurpriseVideo(["only"], session!, () => 0)).toBeNull();
  });

  it("returns nothing when no video is eligible", () => {
    expect(startSurpriseVideo([], [], () => 0)).toBeNull();
  });

  it("forgets a video the visitor can no longer access and remembers the rest", () => {
    const stored = parseVideoSurpriseSession(
      JSON.stringify({ currentId: "member", seenIds: ["open", "member"] }),
    );
    expect(sessionForEligiblePool(stored, ["open"])).toEqual({
      currentId: "",
      seenIds: ["open"],
    });
    const next = startSurpriseVideo(["open", "later"], ["open"], () => 0);
    expect(next?.currentId).toBe("later");
  });
});

describe("videos landing page", () => {
  it("keeps the catalog on the page and opens Surprise Me from the filter row", () => {
    expect(pageSource).toContain("learningLibrarySurpriseRefs(catalogWithPosters)");
    expect(pageSource).toContain("loadMergedVideoCatalog");
    expect(pageSource).not.toMatch(/import\s+videos.*videos-public\.json/);
    expect(pageSource).toContain("Not sure where to start? Let us pick a video for you.");
    expect(pageSource).toContain("Surprise Me");
    expect(pageSource).toContain("kbm-btn kbm-btn-outline video-surprise__start");
    expect(pageSource).not.toContain("kbm-btn kbm-btn-primary video-surprise__start");
    expect(pageSource).toContain("border-radius: 8px");
    expect(pageSource).not.toMatch(/<section[^>]*data-video-surprise/);
    expect(pageSource).toContain("<dialog");
    expect(pageSource).toContain('id="video-surprise-dialog"');
    expect(pageSource).toContain("font-size: 16px");
    expect(pageSource).toContain("Show Me Another");
    expect(pageSource).toContain("Watch Video");
    expect(pageSource).toContain('data-video-surprise-watch');
    expect(pageSource).toContain('aria-live="polite"');
    expect(pageSource).toContain("initLearningLibrarySurprise");
    expect(pageSource).not.toContain("autoplay");
    expect(pageSource).toContain('id="videoSearch"');
    expect(pageSource).toContain("All Videos");
    expect(pageSource).toContain("Free Videos");
    expect(pageSource).toContain("My Favorites");
    expect(pageSource).toContain('id="video-grid"');
    expect(pageSource).toContain('id="video-results-summary"');

    const filters = pageSource.indexOf('class="video-primary-filters"');
    const favorites = pageSource.indexOf("My Favorites");
    const surprise = pageSource.indexOf("data-video-surprise-start");
    const summary = pageSource.indexOf('id="video-results-summary"');
    const grid = pageSource.indexOf('id="video-grid"');
    const dialog = pageSource.indexOf("<dialog");
    expect(filters).toBeGreaterThan(-1);
    expect(filters).toBeLessThan(favorites);
    expect(favorites).toBeLessThan(surprise);
    expect(surprise).toBeLessThan(summary);
    expect(summary).toBeLessThan(grid);
    expect(grid).toBeLessThan(dialog);
  });
});
