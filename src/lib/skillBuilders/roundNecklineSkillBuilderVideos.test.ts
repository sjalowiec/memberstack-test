import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import { calculateRoundNecklineSkillBuilder } from "./roundNecklineSkillBuilders";
import {
  ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS,
  SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID,
  SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY,
  SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING,
  catalogVideoSlotForContentId,
  skillBuilderVideoSlot,
} from "./roundNecklineSkillBuilderVideos";

const SAMPLE_GAUGE = { stitchesPerFourInches: 16, rowsPerFourInches: 24 };
const catalog = videosPublic as PublicVideoRow[];
const videosSource = readFileSync(
  join(process.cwd(), "src/lib/skillBuilders/roundNecklineSkillBuilderVideos.ts"),
  "utf8",
);

describe("Round Neckline Basics shallow-back catalog video", () => {
  it("resolves content_id 2212 to Vimeo 1218264661 with unlisted privacy hash", () => {
    const row = findPublicVideoByContentId(catalog, 2212);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("2212");
    expect(row?.title).toBe("Shallow Neckline, No Shoulder Shaping");
    expect(row?.vimeo_id).toBe(1218264661);
    expect(row?.vimeo_hash).toBe("b1bc386c3c");

    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID).toBe(2212);
    const slot = catalogVideoSlotForContentId(2212);
    expect(slot).not.toBeNull();
    expect(slot?.contentId).toBe(2212);
    expect(slot?.vimeoId).toBe("1218264661");
    expect(slot?.privacyHash).toBe("b1bc386c3c");
    expect(slot?.title).toBe("Shallow Neckline, No Shoulder Shaping");
    expect(skillBuilderVideoSlot("round-neckline-basics/shallow-back")).toEqual(slot);
  });

  it("does not hard-code the Vimeo URL or privacy hash in the Skill Builder video module", () => {
    expect(videosSource).not.toMatch(/player\.vimeo\.com/);
    expect(videosSource).not.toMatch(/vimeo\.com\/1218264661/);
    expect(videosSource).not.toContain("b1bc386c3c");
    expect(videosSource).toContain("vimeo_hash");
  });

  it("keeps the video off other Round Neckline Basics and shaped-shoulder routes", () => {
    expect(ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-neckline-basics"]).toBeNull();
    expect(ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-neckline-basics/deep-front"]).toBeNull();
    expect(ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-necklines-shaped-shoulders"]).toBeNull();
    expect(
      ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-necklines-shaped-shoulders/shallow-back"],
    ).toBeNull();
    expect(
      ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS["round-necklines-shaped-shoulders/deep-front"],
    ).toBeNull();

    expect(calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-neckline-basics", "shallow-back")?.video?.vimeoId).toBe(
      "1218264661",
    );
    expect(calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-neckline-basics", "deep-front")?.video).toBeNull();
    expect(
      calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-necklines-shaped-shoulders", "shallow-back")?.video,
    ).toBeNull();
    expect(
      calculateRoundNecklineSkillBuilder(SAMPLE_GAUGE, "round-necklines-shaped-shoulders", "deep-front")?.video,
    ).toBeNull();
  });
});

describe("Need a little help? video helper copy", () => {
  it("uses the quiet helper heading and short watch line without exposing a Vimeo URL or hash", () => {
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING).toBe("Need a little help?");
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).toBe(
      "Watch the shaping sequence before you begin.",
    );
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING).not.toBe("Watch the Shaping Sequence");
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).not.toContain(
      "Watch the complete process before you begin",
    );
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).not.toMatch(/vimeo\.com/i);
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY).not.toContain("b1bc386c3c");
    expect(SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING).not.toContain("b1bc386c3c");
  });
});
