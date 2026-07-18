import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import lessonsData from "../data/lessons.json";
import videosPublic from "../data/videos-public.json";
import {
  findPublicVideoByKey,
  vimeoNumericIdFromPublicVideo,
  type PublicVideoRow,
} from "./lessonVideo";
import { filterPublicCatalogVideos } from "./videoPublic";
import {
  lessonNonBlocksEmbedSrc,
  lessonNonBlocksVideoFrameMarkup,
  lessonShowsSidebarVideoThumb,
} from "./lessonInlineVideoEmbed";

const here = dirname(fileURLToPath(import.meta.url));
const instructionalBodySource = readFileSync(
  join(here, "..", "components", "lessons", "LessonInstructionalBody.astro"),
  "utf8",
);

const lessons = Array.isArray(lessonsData) ? lessonsData : [];
const catalog = filterPublicCatalogVideos(
  Array.isArray(videosPublic) ? (videosPublic as PublicVideoRow[]) : [],
);

/** Mirror lessons/[slug].astro catalog ? player URL resolution for type:"video". */
function resolveTypeVideoLessonEmbed(slug: string) {
  const lesson = lessons.find((l) => l.slug === slug);
  expect(lesson).toBeTruthy();
  const type = typeof lesson!.type === "string" ? lesson!.type : "";
  const videoSlug =
    typeof lesson!.videoSlug === "string" ? lesson!.videoSlug.trim() : "";
  const row = videoSlug ? findPublicVideoByKey(catalog, videoSlug) : undefined;
  const vimeoId = row ? vimeoNumericIdFromPublicVideo(row) : null;
  const vimeoPlayerSrc = vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : "";
  const hasLessonVideo = type === "video" && vimeoPlayerSrc.length > 0;
  const hasLessonBlocks = Array.isArray(lesson!.blocks) && lesson!.blocks.length > 0;
  const embedSrc = lessonNonBlocksEmbedSrc({
    inlineVimeoSrc: null,
    hasLessonVideo,
    vimeoPlayerSrc,
  });
  return { lesson: lesson!, embedSrc, hasLessonBlocks, hasLessonVideo, vimeoPlayerSrc, vimeoId };
}

describe("lessonNonBlocksEmbedSrc", () => {
  it("prefers inlineVimeoSrc over catalog player src", () => {
    expect(
      lessonNonBlocksEmbedSrc({
        inlineVimeoSrc: "https://player.vimeo.com/video/111",
        hasLessonVideo: true,
        vimeoPlayerSrc: "https://player.vimeo.com/video/222",
      }),
    ).toBe("https://player.vimeo.com/video/111");
  });

  it("uses catalog vimeoPlayerSrc when type:video resolves and inline is absent", () => {
    expect(
      lessonNonBlocksEmbedSrc({
        inlineVimeoSrc: null,
        hasLessonVideo: true,
        vimeoPlayerSrc: "https://player.vimeo.com/video/1175910979",
      }),
    ).toBe("https://player.vimeo.com/video/1175910979");
  });
});

describe("finish-clean-neckband catalog video frame", () => {
  it("renders .lesson-video-frame with resolved Vimeo player iframe", () => {
    const { lesson, embedSrc, hasLessonBlocks, hasLessonVideo, vimeoId } =
      resolveTypeVideoLessonEmbed("finish-clean-neckband");

    expect(lesson.type).toBe("video");
    expect(lesson.videoSlug).toBe("cut-and-sew-sandwich-band");
    expect(hasLessonBlocks).toBe(false);
    expect(hasLessonVideo).toBe(true);
    expect(vimeoId).toBe("1175910979");
    expect(embedSrc).toBe("https://player.vimeo.com/video/1175910979");
    expect(embedSrc).toContain("player.vimeo.com");

    const markup = lessonNonBlocksVideoFrameMarkup(embedSrc!, lesson.title);
    expect(markup).toContain('class="lesson-video-frame lesson-video-frame--modal-trigger"');
    expect(markup).toMatch(/<iframe[^>]*src="https:\/\/player\.vimeo\.com\/video\/1175910979"/);
    expect(markup).toContain("1175910979");

    // Component must wire embedSrc into the non-blocks frame path.
    expect(instructionalBodySource).toContain("lessonNonBlocksEmbedSrc");
    expect(instructionalBodySource).toMatch(/\{embedSrc && \(/);
    expect(instructionalBodySource).toMatch(/src=\{embedSrc\}/);

    // Redundant sidebar thumb is suppressed for this path; modal may remain.
    expect(
      lessonShowsSidebarVideoThumb({
        hasLessonBlocks,
        hasLessonVideo,
        embedSrc,
      }),
    ).toBe(false);
    expect(instructionalBodySource).toContain("showVideoThumb");
  });
});

describe("other type:video + videoSlug lessons", () => {
  const slugs = [
    "change-your-stitch-pattern-to-change-your-width",
    "use-stabilizer-for-clean-confident-cut-n-sew-edges",
    "knit-a-proper-swatch",
  ];

  for (const slug of slugs) {
    it(`${slug} gets a non-blocks embedSrc with player.vimeo.com`, () => {
      const { embedSrc, hasLessonBlocks, hasLessonVideo } = resolveTypeVideoLessonEmbed(slug);
      expect(hasLessonBlocks).toBe(false);
      expect(hasLessonVideo).toBe(true);
      expect(embedSrc).toBeTruthy();
      expect(embedSrc).toContain("player.vimeo.com");
      expect(
        lessonShowsSidebarVideoThumb({
          hasLessonBlocks,
          hasLessonVideo,
          embedSrc,
        }),
      ).toBe(false);
    });
  }
});
