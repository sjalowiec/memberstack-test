import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import { calculateRoundNecklineSkillBuilder } from "./roundNecklineSkillBuilders";
import {
  DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID,
  DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_COPY,
  ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS,
  SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_CONTENT_ID,
  SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_COPY,
  SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID,
  SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY,
  SKILL_BUILDER_VIDEO_HELPER_HEADING,
  catalogVideoSlotForContentId,
  skillBuilderVideoHelperCopy,
  skillBuilderVideoSlot,
} from "./roundNecklineSkillBuilderVideos";

const SAMPLE_GAUGE = { stitchesPerFourInches: 16, rowsPerFourInches: 24 };
const catalog = videosPublic as PublicVideoRow[];
const videosSource = readFileSync(
  join(process.cwd(), "src/lib/skillBuilders/roundNecklineSkillBuilderVideos.ts"),
  "utf8",
);

const EXERCISE_VIDEO_KEYS = [
  "round-neckline-basics/shallow-back",
  "round-neckline-basics/deep-front",
  "round-necklines-shaped-shoulders/shallow-back",
  "round-necklines-shaped-shoulders/deep-front",
] as const;

describe("Round Neckline Skill Builder confirmed video mapping", () => {
  it("Basics / Shallow Back uses catalog 2212 (Shallow Neckline, No Shoulder Shaping)", () => {
    const row = findPublicVideoByContentId(catalog, 2212);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("2212");
    expect(row?.title).toBe("Shallow Neckline, No Shoulder Shaping");
    expect(row?.vimeo_id).toBe(1218264661);

    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID).toBe(2212);
    expect(ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-neckline-basics/shallow-back"]).toBe(
      2212,
    );
    const slot = catalogVideoSlotForContentId(2212);
    expect(slot?.contentId).toBe(2212);
    expect(slot?.vimeoId).toBe("1218264661");
    expect(slot?.privacyHash).toBe("b1bc386c3c");
    expect(skillBuilderVideoSlot("round-neckline-basics/shallow-back")).toEqual(slot);
    expect(
      calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-neckline-basics", "shallow-back")?.video
        ?.contentId,
    ).toBe(2212);
  });

  it("Basics / Deeper Front uses catalog 535 (Easy Round Neck Shaping)", () => {
    const row = findPublicVideoByContentId(catalog, 535);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("535");
    expect(row?.title).toBe("Easy Round Neck Shaping");

    expect(DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID).toBe(535);
    expect(ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-neckline-basics/deep-front"]).toBe(
      535,
    );
    const slot = catalogVideoSlotForContentId(535);
    expect(slot).not.toBeNull();
    expect(slot?.contentId).toBe(535);
    expect(slot?.vimeoId).toBe(String(row!.vimeo_id));
    expect(skillBuilderVideoSlot("round-neckline-basics/deep-front")).toEqual(slot);
    expect(skillBuilderVideoSlot("round-neckline-basics/deep-front")?.contentId).not.toBe(2212);
    expect(skillBuilderVideoSlot("round-neckline-basics/deep-front")?.contentId).not.toBe(2213);
    expect(
      calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-neckline-basics", "deep-front")?.video
        ?.contentId,
    ).toBe(535);
  });

  it("Shaped Shoulders / Shallow Back uses catalog 2213 / Vimeo 1211185343", () => {
    const row = findPublicVideoByContentId(catalog, 2213);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("2213");
    expect(row?.title).toBe("Shallow Round Neckline with Shaped Shoulders");
    expect(row?.vimeo_id).toBe(1211185343);

    expect(SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_CONTENT_ID).toBe(2213);
    expect(
      ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-necklines-shaped-shoulders/shallow-back"],
    ).toBe(2213);
    const slot = catalogVideoSlotForContentId(2213);
    expect(slot?.contentId).toBe(2213);
    expect(slot?.vimeoId).toBe("1211185343");
    expect(skillBuilderVideoSlot("round-necklines-shaped-shoulders/shallow-back")).toEqual(slot);
    expect(
      calculateRoundNecklineSkillBuilder(
        SAMPLE_GAUGE,
        "round-necklines-shaped-shoulders",
        "shallow-back",
      )?.video?.vimeoId,
    ).toBe("1211185343");
  });

  it("Shaped Shoulders / Deeper Front has no helper video", () => {
    expect(
      ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-necklines-shaped-shoulders/deep-front"],
    ).toBeNull();
    expect(skillBuilderVideoSlot("round-necklines-shaped-shoulders/deep-front")).toBeNull();
    expect(skillBuilderVideoHelperCopy("round-necklines-shaped-shoulders/deep-front")).toBeNull();
    expect(
      calculateRoundNecklineSkillBuilder(
        SAMPLE_GAUGE,
        "round-necklines-shaped-shoulders",
        "deep-front",
      )?.video,
    ).toBeNull();
  });

  it("does not assign catalog video 601 (Neckline Shaping Perfection) to any of the four exercises", () => {
    const assigned = EXERCISE_VIDEO_KEYS.map(
      (key) => ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS[key],
    );
    expect(assigned).not.toContain(601);
    for (const key of EXERCISE_VIDEO_KEYS) {
      expect(skillBuilderVideoSlot(key)?.contentId).not.toBe(601);
    }
    const row601 = findPublicVideoByContentId(catalog, 601);
    expect(row601?.title).toBe("Neckline Shaping Perfection");
  });

  it("does not hard-code Vimeo URLs or ids in the Skill Builder video module", () => {
    expect(videosSource).not.toMatch(/player\.vimeo\.com/);
    expect(videosSource).not.toContain("1218264661");
    expect(videosSource).not.toContain("1211185343");
    expect(videosSource).not.toContain("151858551");
    expect(videosSource).not.toContain("b1bc386c3c");
    expect(videosSource).toContain("vimeo_hash");
  });
});

describe("Need a little help? video helper copy", () => {
  it("uses the quiet helper heading and short watch line on Basics / Shallow Back", () => {
    expect(SKILL_BUILDER_VIDEO_HELPER_HEADING).toBe("Need a little help?");
    expect(skillBuilderVideoHelperCopy("round-neckline-basics/shallow-back")).toEqual({
      heading: SKILL_BUILDER_VIDEO_HELPER_HEADING,
      notes: [{ text: SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY }],
    });
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).toBe(
      "Watch the shaping sequence before you begin.",
    );
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).not.toMatch(/vimeo\.com/i);
  });

  it("describes the scrap-off / rehang method on Basics / Deeper Front", () => {
    expect(skillBuilderVideoHelperCopy("round-neckline-basics/deep-front")).toEqual({
      heading: SKILL_BUILDER_VIDEO_HELPER_HEADING,
      notes: [{ text: DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_COPY }],
    });
    expect(DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_COPY).toBe(
      "Watch this demonstration of the scrap-off, rehang, and bind-off-and-decrease method before you begin.",
    );
    expect(DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_COPY).not.toMatch(/stitch|row count/i);
  });

  it("describes short-row shoulder shaping on Shaped Shoulders / Shallow Back", () => {
    expect(skillBuilderVideoHelperCopy("round-necklines-shaped-shoulders/shallow-back")).toEqual({
      heading: SKILL_BUILDER_VIDEO_HELPER_HEADING,
      notes: [{ text: SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_COPY }],
    });
    expect(SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_COPY).toBe(
      "Watch this demonstration of a shallow round back neckline with short-row shoulder shaping before you begin.",
    );
    expect(SHALLOW_BACK_SHAPED_SHOULDER_VIDEO_COPY).not.toMatch(/stitch|row count/i);
  });
});
