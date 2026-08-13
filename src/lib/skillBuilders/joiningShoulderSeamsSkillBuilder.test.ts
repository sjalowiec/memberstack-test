import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { vimeoNumericIdFromPublicVideo } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import {
  getJoiningShoulderSeamsSkillBuilder,
  JOINING_SHOULDER_SEAMS_CHECKLIST,
  JOINING_SHOULDER_SEAMS_INTRO,
  JOINING_SHOULDER_SEAMS_PATH,
  JOINING_SHOULDER_SEAMS_RELATED_PRACTICE,
  JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID,
  JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID,
  JOINING_SHOULDER_SEAMS_THREE_NEEDLE_PHRASE,
  JOINING_SHOULDER_SEAMS_TITLE,
  JOINING_SHOULDER_SEAMS_WHAT_YOULL_PRACTICE,
  joiningShoulderSeamsChecklistParts,
  joiningShoulderSeamsIntroParts,
} from "./joiningShoulderSeamsSkillBuilder";
import {
  JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID,
  joiningShoulderSeamsVideoSlot,
} from "./joiningShoulderSeamsSkillBuilderVideos";

const catalog = videosPublic as PublicVideoRow[];

describe("Join Beautiful Shoulder Seams Skill Builder", () => {
  it("uses a stable public route, short intro, and six-step checklist", () => {
    const builder = getJoiningShoulderSeamsSkillBuilder();
    expect(builder.id).toBe(JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID);
    expect(builder.title).toBe("Join Beautiful Shoulder Seams");
    expect(JOINING_SHOULDER_SEAMS_TITLE).toBe("Join Beautiful Shoulder Seams");
    expect(builder.path).toBe("/learn/skill-builders/join-beautiful-shoulder-seams");
    expect(JOINING_SHOULDER_SEAMS_PATH).toBe("/learn/skill-builders/join-beautiful-shoulder-seams");
    expect(builder.intro).toBe(
      "Create a neat, stable shoulder seam directly on your knitting machine, similar to a hand knitting 3-needle bind off.",
    );
    expect(JOINING_SHOULDER_SEAMS_INTRO).toBe(builder.intro);
    expect(builder.whatYoullPractice).toBe(
      "Rehang the front and back shoulder stitches, pull the stitches together through the needle hooks, and bind off a tidy, stable shoulder seam.",
    );
    expect(builder.checklist).toEqual([
      "Remove the shoulder stitches on waste yarn, leaving a tail at least three times the width of the shoulder seam.",
      "With the public side facing you, rehang the back shoulder stitches. Check that every stitch is on a needle, then push the stitches behind the latches.",
      "With the private side facing you, rehang the matching front shoulder stitches, leaving each stitch in the hook.",
      "Close the latches and carefully push the needles back, pulling each front stitch through its matching back stitch with the yarn tail.",
      "Bind off using your preferred method.",
      "Repeat for the second shoulder.",
    ]);
    expect(JOINING_SHOULDER_SEAMS_CHECKLIST).toHaveLength(6);
    expect(JOINING_SHOULDER_SEAMS_CHECKLIST).toEqual(builder.checklist);
    expect(JOINING_SHOULDER_SEAMS_WHAT_YOULL_PRACTICE).toBe(builder.whatYoullPractice);
    expect(JOINING_SHOULDER_SEAMS_RELATED_PRACTICE).toEqual({
      href: "/learn/skill-builders/round-neckline-basics",
      eyebrow: "RELATED SKILL BUILDER",
      title: "Shape a Round Neckline",
      supportingText:
        "Practice the neckline shaping that comes before you join the shoulders.",
    });
  });

  it("adds a glossary tooltip on 3-needle bind off in the intro only", () => {
    expect(JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID).toBe(522);
    expect(JOINING_SHOULDER_SEAMS_THREE_NEEDLE_PHRASE).toBe("3-needle bind off");
    expect(joiningShoulderSeamsIntroParts()).toEqual([
      {
        type: "text",
        text: "Create a neat, stable shoulder seam directly on your knitting machine, similar to a hand knitting ",
      },
      { type: "glossary", glossaryId: 522, text: "3-needle bind off" },
      { type: "text", text: "." },
    ]);
    expect(joiningShoulderSeamsIntroParts("No glossary phrase here.")).toEqual([
      { type: "text", text: "No glossary phrase here." },
    ]);
    expect(
      joiningShoulderSeamsIntroParts(
        "A 3-needle bind off and another 3-needle bind off.",
      ).filter((part) => part.type === "glossary"),
    ).toEqual([{ type: "glossary", glossaryId: 522, text: "3-needle bind off" }]);
  });

  it("adds glossary tooltips on the first public side and private side only", () => {
    const parts = joiningShoulderSeamsChecklistParts();
    const glossaryParts = parts.flat().filter((part) => part.type === "glossary");
    expect(glossaryParts).toEqual([
      { type: "glossary", glossaryId: 322, text: "public side" },
      { type: "glossary", glossaryId: 323, text: "private side" },
    ]);

    const repeated = joiningShoulderSeamsChecklistParts([
      "With the public side facing you.",
      "Keep the public side facing the same way.",
      "With the private side facing you.",
      "The private side stays inside.",
    ]);
    expect(
      repeated.flat().filter((part) => part.type === "glossary"),
    ).toEqual([
      { type: "glossary", glossaryId: 322, text: "public side" },
      { type: "glossary", glossaryId: 323, text: "private side" },
    ]);
    expect(repeated[1]).toEqual([{ type: "text", text: "Keep the public side facing the same way." }]);
    expect(repeated[3]).toEqual([{ type: "text", text: "The private side stays inside." }]);
  });

  it("wires Learning Library video #202 into the Skill Builder video slot", () => {
    const row = findPublicVideoByContentId(catalog, 202);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("202");
    const vimeoId = vimeoNumericIdFromPublicVideo(row!);
    expect(vimeoId).toBe("151860051");

    const slot = joiningShoulderSeamsVideoSlot();
    expect(JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID).toBe(202);
    expect(slot).not.toBeNull();
    expect(slot?.contentId).toBe(202);
    expect(slot?.vimeoId).toBe(vimeoId);
    expect(slot?.title).toMatch(/shoulder/i);
    expect(getJoiningShoulderSeamsSkillBuilder().video?.contentId).toBe(202);
    expect(getJoiningShoulderSeamsSkillBuilder().video?.vimeoId).toBe("151860051");
  });
});
