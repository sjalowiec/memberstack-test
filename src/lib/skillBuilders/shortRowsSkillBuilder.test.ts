import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { vimeoNumericIdFromPublicVideo } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import {
  getShortRowsSkillBuilder,
  SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID,
  SHORT_ROWS_CATALOG_SUBTITLE,
  SHORT_ROWS_COMPLETION_OPTIONS,
  SHORT_ROWS_COMPLETION_PROMPT,
  SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID,
  SHORT_ROWS_INTRO_PARAGRAPHS,
  SHORT_ROWS_MANUAL_WRAP_GLOSSARY_ID,
  SHORT_ROWS_PATH,
  SHORT_ROWS_PRACTICE_1_STEPS,
  SHORT_ROWS_PRACTICE_2_LEAD,
  SHORT_ROWS_PRACTICE_2_STEPS,
  SHORT_ROWS_PRACTICE_SETUP,
  SHORT_ROWS_SHORT_ROW_GLOSSARY_ID,
  SHORT_ROWS_SKILL_BUILDER_ID,
  SHORT_ROWS_SUBTITLE,
  SHORT_ROWS_SUE_TIP,
  SHORT_ROWS_TITLE,
  SHORT_ROWS_WHAT_YOULL_LEARN,
  SHORT_ROWS_WRAP_GLOSSARY_ID,
  shortRowsIntroParts,
  shortRowsPractice1Parts,
  shortRowsPractice2LeadParts,
  shortRowsWhatYoullLearnParts,
} from "./shortRowsSkillBuilder";
import {
  SHORT_ROWS_VIDEO_CONTENT_ID,
  shortRowsVideoSlot,
} from "./shortRowsSkillBuilderVideos";

const catalog = videosPublic as PublicVideoRow[];

describe("Short Rows Practice Skill Builder", () => {
  it("uses a stable public route, subtitle, intro, and both wrapping practices", () => {
    const builder = getShortRowsSkillBuilder();
    expect(builder.id).toBe(SHORT_ROWS_SKILL_BUILDER_ID);
    expect(builder.title).toBe("Short Rows Practice");
    expect(SHORT_ROWS_TITLE).toBe("Short Rows Practice");
    expect(builder.path).toBe("/learn/skill-builders/short-rows");
    expect(SHORT_ROWS_PATH).toBe("/learn/skill-builders/short-rows");
    expect(builder.subtitle).toBe("Practice manual and automatic wrapping");
    expect(SHORT_ROWS_SUBTITLE).toBe(builder.subtitle);
    expect(SHORT_ROWS_CATALOG_SUBTITLE).toBe(builder.subtitle);
    expect(builder.introParagraphs).toEqual([
      "Short rows, sometimes called partial knitting, shape only part of the knitting while the remaining stitches stay in holding position. They are commonly used for shoulders, bust darts, sock heels and toes, mitten tops, and circular pieces.",
      "The purpose of wrapping is to prevent a hole at the point where the carriage reverses direction.",
    ]);
    expect(SHORT_ROWS_INTRO_PARAGRAPHS).toEqual(builder.introParagraphs);
    expect(builder.whatYoullLearn).toEqual([
      "How holding position creates short rows",
      "Why holes can form at short-row turns",
      "How to wrap a short-row stitch manually",
      "How carriage position creates an automatic wrap",
      "How to recognize a properly wrapped stitch",
    ]);
    expect(SHORT_ROWS_WHAT_YOULL_LEARN).toEqual(builder.whatYoullLearn);
    expect(builder.practiceSetup).toEqual([
      "Smooth, light-colored yarn",
      "24 stitches",
      "Main tension appropriate for the yarn",
      "Carriage set to hold according to the knitter’s machine",
      "Appropriate weights",
      "Knit 10 rows before beginning the exercise",
    ]);
    expect(SHORT_ROWS_PRACTICE_SETUP).toEqual(builder.practiceSetup);
    expect(builder.practice1Steps).toHaveLength(9);
    expect(SHORT_ROWS_PRACTICE_1_STEPS).toEqual(builder.practice1Steps);
    expect(builder.practice2Steps).toHaveLength(11);
    expect(SHORT_ROWS_PRACTICE_2_STEPS).toEqual(builder.practice2Steps);
    expect(builder.practice2Steps.slice(0, 3)).toEqual([
      "Return all held needles to working position.",
      "Knit 4 rows even to visually separate the two practice sections.",
      "Begin the automatic-wrapping exercise with all 24 stitches working.",
    ]);
    expect(builder.sueTip).toBe(
      "The secret to automatic wrapping is carriage position. Slow down and check where your carriage and working yarn are before moving the next needle into hold.",
    );
    expect(SHORT_ROWS_SUE_TIP).toBe(builder.sueTip);
    expect(builder.completionPrompt).toBe("Which method felt more comfortable?");
    expect(SHORT_ROWS_COMPLETION_PROMPT).toBe(builder.completionPrompt);
    expect(builder.completionOptions).toEqual([
      "Manual wrapping",
      "Automatic wrapping",
      "I need another try",
    ]);
    expect(SHORT_ROWS_COMPLETION_OPTIONS).toEqual(builder.completionOptions);
  });

  it("mentions socks as one application without sock-specific heel or toe instructions", () => {
    const intro = SHORT_ROWS_INTRO_PARAGRAPHS.join(" ");
    expect(intro).toMatch(/sock heels and toes/i);
    const exerciseCopy = [
      ...SHORT_ROWS_WHAT_YOULL_LEARN,
      ...SHORT_ROWS_PRACTICE_SETUP,
      ...SHORT_ROWS_PRACTICE_1_STEPS,
      SHORT_ROWS_PRACTICE_2_LEAD,
      ...SHORT_ROWS_PRACTICE_2_STEPS,
      SHORT_ROWS_SUE_TIP,
    ].join(" ");
    expect(exerciseCopy).not.toMatch(/\bheel\b/i);
    expect(exerciseCopy).not.toMatch(/\btoe\b/i);
    expect(exerciseCopy).not.toMatch(/\bsock\b/i);
  });

  it("keeps automatic wrapping tied to carriage position and the next needle moved into hold", () => {
    const practice2 = [SHORT_ROWS_PRACTICE_2_LEAD, ...SHORT_ROWS_PRACTICE_2_STEPS].join(" ");
    expect(SHORT_ROWS_PRACTICE_2_STEPS[0]).toMatch(/working position/i);
    expect(SHORT_ROWS_PRACTICE_2_STEPS[1]).toMatch(/knit 4 rows even/i);
    expect(SHORT_ROWS_PRACTICE_2_STEPS[2]).toMatch(/all 24 stitches working/i);
    expect(practice2).not.toMatch(/continue on the same 24-stitch practice piece/i);
    expect(practice2).toMatch(/carriage side/i);
    expect(practice2).toMatch(/one more needle into hold/i);
    expect(practice2).toMatch(/one fewer than the 3-needle group/i);
    expect(practice2).toMatch(/wraps automatically/i);
    expect(practice2).toMatch(/compare those turning points/i);
    expect(practice2).not.toMatch(/opposite the carriage, then manually wrapping/i);
  });

  it("adds glossary tooltips on the first short rows, holding position, and wrapping mentions", () => {
    expect(SHORT_ROWS_SHORT_ROW_GLOSSARY_ID).toBe(811);
    expect(SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID).toBe(185);
    expect(SHORT_ROWS_WRAP_GLOSSARY_ID).toBe(640);
    expect(SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID).toBe(346);
    expect(SHORT_ROWS_MANUAL_WRAP_GLOSSARY_ID).toBe(718);

    const introGlossary = shortRowsIntroParts()
      .flat()
      .filter((part) => part.type === "glossary");
    expect(introGlossary).toEqual([
      { type: "glossary", glossaryId: 811, text: "Short rows" },
      { type: "glossary", glossaryId: 185, text: "holding position" },
      { type: "glossary", glossaryId: 640, text: "wrapping" },
    ]);

    const learnGlossary = shortRowsWhatYoullLearnParts()
      .flat()
      .filter((part) => part.type === "glossary");
    expect(learnGlossary).toEqual([
      { type: "glossary", glossaryId: 185, text: "holding position" },
      { type: "glossary", glossaryId: 346, text: "automatic wrap" },
    ]);

    const practice1Glossary = shortRowsPractice1Parts()
      .flat()
      .filter((part) => part.type === "glossary");
    expect(practice1Glossary).toEqual([
      { type: "glossary", glossaryId: 185, text: "holding position" },
      { type: "glossary", glossaryId: 718, text: "Manually wrap" },
    ]);

    expect(
      shortRowsPractice2LeadParts()
        .filter((part) => part.type === "glossary"),
    ).toEqual([{ type: "glossary", glossaryId: 346, text: "automatic wrap" }]);
  });

  it("wires Learning Library video #330 into the Skill Builder video slot", () => {
    const row = findPublicVideoByContentId(catalog, 330);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("330");
    expect(row?.title).toMatch(/automatic wrap versus manual wrap/i);
    const vimeoId = vimeoNumericIdFromPublicVideo(row!);
    expect(vimeoId).toMatch(/^\d+$/);

    const slot = shortRowsVideoSlot();
    expect(SHORT_ROWS_VIDEO_CONTENT_ID).toBe(330);
    expect(slot).not.toBeNull();
    expect(slot?.contentId).toBe(330);
    expect(slot?.vimeoId).toBe(vimeoId);
    expect(slot?.accessLevel).toBe("member");
    expect(getShortRowsSkillBuilder().video?.contentId).toBe(330);
    expect(getShortRowsSkillBuilder().video?.accessLevel).toBe("member");
    expect(getShortRowsSkillBuilder().video?.vimeoId).toBe(vimeoId);
  });
});
