import {
  eWrapCastOnVideoSlot,
  type EWrapCastOnVideoSlot,
} from "./eWrapCastOnSkillBuilderVideos";

export const E_WRAP_CAST_ON_SKILL_BUILDER_ID = "e-wrap-cast-on-basics";

export const E_WRAP_CAST_ON_PATH = "/learn/skill-builders/e-wrap-cast-on-basics";

export const E_WRAP_CAST_ON_TITLE = "E-Wrap Cast On Basics";

export const E_WRAP_CAST_ON_INTRO =
  "The e-wrap cast on is quick, stretchy, and useful on any knitting machine. Practice making the cast-on edge, then see how to prepare it for knitting with weights.";

export const E_WRAP_CAST_ON_WHAT_YOULL_PRACTICE =
  "You'll make an e-wrap cast on, knit the first row, and examine the neat, stretchy edge it creates.";

export const E_WRAP_CAST_ON_CATALOG_SUBTITLE =
  "Practice a quick, stretchy cast on that works on any knitting machine.";

export const E_WRAP_CAST_ON_CHECKLIST: readonly string[] = [
  "Set the needles you want to use into working position.",
  "E-wrap each needle counterclockwise, like a lowercase script e.",
  "Keep the loops pushed back toward the needle bed.",
  "Knit the first row slowly.",
  "Knit a short sample.",
  "Remove the sample from the machine and examine the neat, stretchy edge.",
];

export const E_WRAP_CAST_ON_WEIGHTS_HEADING = "Using weights";

export const E_WRAP_CAST_ON_WEIGHTS_NOTE =
  "E-wrap creates loops on the needles, but it does not give you an easy way to hang weights. If you need weights to knit your sample, first knit a few rows of waste yarn with ravel cord and hang your weights, as shown in the video.";

export const E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID = 312;
export const E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID = 207;
export const E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID = 239;
export const E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID = 249;

export type EWrapCastOnCopyPart =
  | { type: "text"; text: string }
  | { type: "glossary"; glossaryId: number; text: string };

type GlossaryTerm = { phrase: string; glossaryId: number };

function splitFirstGlossaryMentions(
  text: string,
  terms: readonly GlossaryTerm[],
  used: Set<number>,
): EWrapCastOnCopyPart[] {
  const parts: EWrapCastOnCopyPart[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let next: { index: number; glossaryId: number; text: string } | null = null;
    for (const term of terms) {
      if (used.has(term.glossaryId)) continue;
      const index = remaining.toLowerCase().indexOf(term.phrase);
      if (index < 0) continue;
      if (next === null || index < next.index) {
        next = {
          index,
          glossaryId: term.glossaryId,
          text: remaining.slice(index, index + term.phrase.length),
        };
      }
    }
    if (!next) {
      parts.push({ type: "text", text: remaining });
      break;
    }
    if (next.index > 0) {
      parts.push({ type: "text", text: remaining.slice(0, next.index) });
    }
    parts.push({ type: "glossary", glossaryId: next.glossaryId, text: next.text });
    used.add(next.glossaryId);
    remaining = remaining.slice(next.index + next.text.length);
  }
  return parts;
}

/** Split the intro so only the first “e-wrap” mention becomes a glossary tooltip. */
export function eWrapCastOnIntroParts(
  intro: string = E_WRAP_CAST_ON_INTRO,
): EWrapCastOnCopyPart[] {
  return splitFirstGlossaryMentions(
    intro,
    [{ phrase: "e-wrap", glossaryId: E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID }],
    new Set(),
  );
}

/** Split checklist copy so only the first “working position” mention becomes a tooltip. */
export function eWrapCastOnChecklistParts(
  steps: readonly string[] = E_WRAP_CAST_ON_CHECKLIST,
): EWrapCastOnCopyPart[][] {
  const used = new Set<number>();
  const terms = [
    { phrase: "working position", glossaryId: E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID },
  ] as const;
  return steps.map((step) => splitFirstGlossaryMentions(step, terms, used));
}

/** Split the weights note so waste yarn and ravel cord become glossary tooltips. */
export function eWrapCastOnWeightsNoteParts(
  note: string = E_WRAP_CAST_ON_WEIGHTS_NOTE,
): EWrapCastOnCopyPart[] {
  return splitFirstGlossaryMentions(
    note,
    [
      { phrase: "waste yarn", glossaryId: E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID },
      { phrase: "ravel cord", glossaryId: E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID },
    ],
    new Set(),
  );
}

export type EWrapCastOnSkillBuilder = {
  id: typeof E_WRAP_CAST_ON_SKILL_BUILDER_ID;
  title: string;
  intro: string;
  whatYoullPractice: string;
  path: string;
  checklist: readonly string[];
  weightsHeading: string;
  weightsNote: string;
  video: EWrapCastOnVideoSlot | null;
};

export function getEWrapCastOnSkillBuilder(): EWrapCastOnSkillBuilder {
  return {
    id: E_WRAP_CAST_ON_SKILL_BUILDER_ID,
    title: E_WRAP_CAST_ON_TITLE,
    intro: E_WRAP_CAST_ON_INTRO,
    whatYoullPractice: E_WRAP_CAST_ON_WHAT_YOULL_PRACTICE,
    path: E_WRAP_CAST_ON_PATH,
    checklist: E_WRAP_CAST_ON_CHECKLIST,
    weightsHeading: E_WRAP_CAST_ON_WEIGHTS_HEADING,
    weightsNote: E_WRAP_CAST_ON_WEIGHTS_NOTE,
    video: eWrapCastOnVideoSlot(),
  };
}
