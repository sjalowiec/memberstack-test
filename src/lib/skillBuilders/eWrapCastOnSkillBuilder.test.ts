import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { vimeoNumericIdFromPublicVideo } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import {
  E_WRAP_CAST_ON_CATALOG_SUBTITLE,
  E_WRAP_CAST_ON_CHECKLIST,
  E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID,
  E_WRAP_CAST_ON_INTRO,
  E_WRAP_CAST_ON_PATH,
  E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID,
  E_WRAP_CAST_ON_SKILL_BUILDER_ID,
  E_WRAP_CAST_ON_TITLE,
  E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID,
  E_WRAP_CAST_ON_WEIGHTS_HEADING,
  E_WRAP_CAST_ON_WEIGHTS_NOTE,
  E_WRAP_CAST_ON_WHAT_YOULL_PRACTICE,
  E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID,
  eWrapCastOnChecklistParts,
  eWrapCastOnIntroParts,
  eWrapCastOnWeightsNoteParts,
  getEWrapCastOnSkillBuilder,
} from "./eWrapCastOnSkillBuilder";
import {
  E_WRAP_CAST_ON_VIDEO_CONTENT_ID,
  eWrapCastOnVideoSlot,
} from "./eWrapCastOnSkillBuilderVideos";

const catalog = videosPublic as PublicVideoRow[];

describe("E-Wrap Cast On Basics Skill Builder", () => {
  it("uses a stable public route, short intro, six-step checklist, and weights note", () => {
    const builder = getEWrapCastOnSkillBuilder();
    expect(builder.id).toBe(E_WRAP_CAST_ON_SKILL_BUILDER_ID);
    expect(builder.title).toBe("E-Wrap Cast On Basics");
    expect(E_WRAP_CAST_ON_TITLE).toBe("E-Wrap Cast On Basics");
    expect(builder.path).toBe("/learn/skill-builders/e-wrap-cast-on-basics");
    expect(E_WRAP_CAST_ON_PATH).toBe("/learn/skill-builders/e-wrap-cast-on-basics");
    expect(builder.intro).toBe(
      "The e-wrap cast on is quick, stretchy, and useful on any knitting machine. Practice making the cast-on edge, then see how to prepare it for knitting with weights.",
    );
    expect(E_WRAP_CAST_ON_INTRO).toBe(builder.intro);
    expect(builder.whatYoullPractice).toBe(
      "You'll make an e-wrap cast on, knit the first row, and examine the neat, stretchy edge it creates.",
    );
    expect(E_WRAP_CAST_ON_WHAT_YOULL_PRACTICE).toBe(builder.whatYoullPractice);
    expect(E_WRAP_CAST_ON_CATALOG_SUBTITLE).toBe(
      "Practice a quick, stretchy cast on that works on any knitting machine.",
    );
    expect(builder.checklist).toEqual([
      "Set the needles you want to use into working position.",
      "E-wrap each needle counterclockwise, like a lowercase script e.",
      "Keep the loops pushed back toward the needle bed.",
      "Knit the first row slowly.",
      "Knit a short sample.",
      "Remove the sample from the machine and examine the neat, stretchy edge.",
    ]);
    expect(E_WRAP_CAST_ON_CHECKLIST).toHaveLength(6);
    expect(E_WRAP_CAST_ON_CHECKLIST).toEqual(builder.checklist);
    expect(builder.weightsHeading).toBe("Using weights");
    expect(E_WRAP_CAST_ON_WEIGHTS_HEADING).toBe(builder.weightsHeading);
    expect(builder.weightsNote).toBe(
      "E-wrap creates loops on the needles, but it does not give you an easy way to hang weights. If you need weights to knit your sample, first knit a few rows of waste yarn with ravel cord and hang your weights, as shown in the video.",
    );
    expect(E_WRAP_CAST_ON_WEIGHTS_NOTE).toBe(builder.weightsNote);
    expect(builder.checklist.join(" ")).not.toMatch(/waste yarn|ravel cord/i);
  });

  it("adds a glossary tooltip on e-wrap in the intro only", () => {
    expect(E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID).toBe(312);
    expect(eWrapCastOnIntroParts()).toEqual([
      { type: "text", text: "The " },
      { type: "glossary", glossaryId: 312, text: "e-wrap" },
      {
        type: "text",
        text: " cast on is quick, stretchy, and useful on any knitting machine. Practice making the cast-on edge, then see how to prepare it for knitting with weights.",
      },
    ]);
    expect(eWrapCastOnIntroParts("No glossary phrase here.")).toEqual([
      { type: "text", text: "No glossary phrase here." },
    ]);
    expect(
      eWrapCastOnIntroParts("An e-wrap and another e-wrap.")
        .filter((part) => part.type === "glossary"),
    ).toEqual([{ type: "glossary", glossaryId: 312, text: "e-wrap" }]);
  });

  it("adds a glossary tooltip on the first working position only", () => {
    expect(E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID).toBe(207);
    const parts = eWrapCastOnChecklistParts();
    const glossaryParts = parts.flat().filter((part) => part.type === "glossary");
    expect(glossaryParts).toEqual([
      { type: "glossary", glossaryId: 207, text: "working position" },
    ]);

    const repeated = eWrapCastOnChecklistParts([
      "Set needles into working position.",
      "Keep them in working position.",
    ]);
    expect(repeated.flat().filter((part) => part.type === "glossary")).toEqual([
      { type: "glossary", glossaryId: 207, text: "working position" },
    ]);
    expect(repeated[1]).toEqual([{ type: "text", text: "Keep them in working position." }]);
  });

  it("adds glossary tooltips on waste yarn and ravel cord in the weights note", () => {
    expect(E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID).toBe(239);
    expect(E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID).toBe(249);
    expect(eWrapCastOnWeightsNoteParts()).toEqual([
      {
        type: "text",
        text: "E-wrap creates loops on the needles, but it does not give you an easy way to hang weights. If you need weights to knit your sample, first knit a few rows of ",
      },
      { type: "glossary", glossaryId: 239, text: "waste yarn" },
      { type: "text", text: " with " },
      { type: "glossary", glossaryId: 249, text: "ravel cord" },
      { type: "text", text: " and hang your weights, as shown in the video." },
    ]);
  });

  it("wires Learning Library video #206 into the Skill Builder video slot", () => {
    const row = findPublicVideoByContentId(catalog, 206);
    expect(row).toBeDefined();
    expect(String(row?.content_id)).toBe("206");
    const vimeoId = vimeoNumericIdFromPublicVideo(row!);
    expect(vimeoId).toBe("151860058");

    const slot = eWrapCastOnVideoSlot();
    expect(E_WRAP_CAST_ON_VIDEO_CONTENT_ID).toBe(206);
    expect(slot).not.toBeNull();
    expect(slot?.contentId).toBe(206);
    expect(slot?.vimeoId).toBe(vimeoId);
    expect(slot?.title).toMatch(/e-wrap/i);
    expect(slot?.accessLevel).toBe("public");
    expect(getEWrapCastOnSkillBuilder().video?.contentId).toBe(206);
    expect(getEWrapCastOnSkillBuilder().video?.accessLevel).toBe("public");
    expect(getEWrapCastOnSkillBuilder().video?.vimeoId).toBe("151860058");
  });
});
