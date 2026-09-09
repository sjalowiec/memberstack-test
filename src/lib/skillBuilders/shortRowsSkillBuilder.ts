import {
  shortRowsVideoSlot,
  type ShortRowsVideoSlot,
} from "./shortRowsSkillBuilderVideos";

export const SHORT_ROWS_SKILL_BUILDER_ID = "short-rows";

export const SHORT_ROWS_PATH = "/learn/skill-builders/short-rows";

export const SHORT_ROWS_TITLE = "Short Rows Practice";

export const SHORT_ROWS_SUBTITLE = "Practice manual and automatic wrapping";

export const SHORT_ROWS_CATALOG_SUBTITLE = SHORT_ROWS_SUBTITLE;

export const SHORT_ROWS_INTRO_PARAGRAPHS: readonly string[] = [
  "Short rows, sometimes called partial knitting, shape only part of the knitting while the remaining stitches stay in holding position. They are commonly used for shoulders, bust darts, sock heels and toes, mitten tops, and circular pieces.",
  "The purpose of wrapping is to prevent a hole at the point where the carriage reverses direction.",
];

export const SHORT_ROWS_WHAT_YOULL_LEARN: readonly string[] = [
  "How holding position creates short rows",
  "Why holes can form at short-row turns",
  "How to wrap a short-row stitch manually",
  "How carriage position creates an automatic wrap",
  "How to recognize a properly wrapped stitch",
];

export const SHORT_ROWS_PRACTICE_SETUP: readonly string[] = [
  "Smooth, light-colored yarn",
  "24 stitches",
  "Main tension appropriate for the yarn",
  "Carriage set to hold according to the knitter’s machine",
  "Appropriate weights",
  "Knit 10 rows before beginning the exercise",
];

export const SHORT_ROWS_PRACTICE_1_HEADING = "Practice 1: Manual Wrapping";

export const SHORT_ROWS_PRACTICE_1_STEPS: readonly string[] = [
  "Cast on 24 stitches and knit 10 rows.",
  "Place 3 needles opposite the carriage into holding position.",
  "Set the carriage to hold and knit across.",
  "Notice how the working yarn lies across the held needles.",
  "Manually wrap the last needle placed into hold.",
  "Knit back.",
  "Repeat, placing 3 additional needles into hold and wrapping at each turn.",
  "Work the sequence 3 times.",
  "Examine the turning points for holes.",
];

export const SHORT_ROWS_PRACTICE_2_HEADING = "Practice 2: Automatic Wrapping";

/**
 * Automatic-wrap sequence from catalog content ID 330 (glossary “Automatic Wrap”)
 * and the Knit it Now short-row Skill Builder: hold one fewer needle opposite the
 * carriage, knit across, then pull one more needle into hold on the carriage side.
 */
export const SHORT_ROWS_PRACTICE_2_LEAD =
  "Use the automatic wrap method shown in the video. The wrap happens because of carriage position: after you knit across, the next needle moved into hold is on the carriage side and wraps automatically.";

export const SHORT_ROWS_PRACTICE_2_STEPS: readonly string[] = [
  "Return all held needles to working position.",
  "Knit 4 rows even to visually separate the two practice sections.",
  "Begin the automatic-wrapping exercise with all 24 stitches working.",
  "Slow down and check where the carriage and working yarn are before you move the next needle into hold.",
  "Opposite the carriage, place 2 needles into holding position — one fewer than the 3-needle group from Practice 1.",
  "Knit across. The carriage is now on the same side as those held needles.",
  "Pull one more needle into hold. That needle is on the carriage side and wraps automatically.",
  "Knit back.",
  "Repeat, placing 2 additional needles opposite the carriage, knitting across, then pulling one more needle into hold on the carriage side.",
  "Work the sequence several times.",
  "Compare those turning points with the manually wrapped section.",
];

export const SHORT_ROWS_SUE_TIP_HEADING = "Sue’s Tip";

export const SHORT_ROWS_SUE_TIP =
  "The secret to automatic wrapping is carriage position. Slow down and check where your carriage and working yarn are before moving the next needle into hold.";

export const SHORT_ROWS_COMPLETION_PROMPT = "Which method felt more comfortable?";

export const SHORT_ROWS_COMPLETION_OPTIONS: readonly string[] = [
  "Manual wrapping",
  "Automatic wrapping",
  "I need another try",
];

export const SHORT_ROWS_SHORT_ROW_GLOSSARY_ID = 811;
export const SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID = 185;
export const SHORT_ROWS_WRAP_GLOSSARY_ID = 640;
export const SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID = 346;
export const SHORT_ROWS_MANUAL_WRAP_GLOSSARY_ID = 718;

export type ShortRowsCopyPart =
  | { type: "text"; text: string }
  | { type: "glossary"; glossaryId: number; text: string };

type GlossaryTerm = { phrase: string; glossaryId: number };

function splitFirstGlossaryMentions(
  text: string,
  terms: readonly GlossaryTerm[],
  used: Set<number>,
): ShortRowsCopyPart[] {
  const parts: ShortRowsCopyPart[] = [];
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

/** Split intro copy so the first short-rows, holding-position, and wrapping mentions become tooltips. */
export function shortRowsIntroParts(
  paragraphs: readonly string[] = SHORT_ROWS_INTRO_PARAGRAPHS,
): ShortRowsCopyPart[][] {
  const used = new Set<number>();
  const terms = [
    { phrase: "short rows", glossaryId: SHORT_ROWS_SHORT_ROW_GLOSSARY_ID },
    { phrase: "holding position", glossaryId: SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID },
    { phrase: "wrapping", glossaryId: SHORT_ROWS_WRAP_GLOSSARY_ID },
  ] as const;
  return paragraphs.map((paragraph) => splitFirstGlossaryMentions(paragraph, terms, used));
}

/** Split What You’ll Learn so the first holding-position and automatic-wrap mentions become tooltips. */
export function shortRowsWhatYoullLearnParts(
  items: readonly string[] = SHORT_ROWS_WHAT_YOULL_LEARN,
): ShortRowsCopyPart[][] {
  const used = new Set<number>();
  const terms = [
    { phrase: "holding position", glossaryId: SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID },
    { phrase: "automatic wrap", glossaryId: SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID },
  ] as const;
  return items.map((item) => splitFirstGlossaryMentions(item, terms, used));
}

/** Split Practice 1 so the first holding-position and manually-wrap mentions become tooltips. */
export function shortRowsPractice1Parts(
  steps: readonly string[] = SHORT_ROWS_PRACTICE_1_STEPS,
): ShortRowsCopyPart[][] {
  const used = new Set<number>();
  const terms = [
    { phrase: "holding position", glossaryId: SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID },
    { phrase: "manually wrap", glossaryId: SHORT_ROWS_MANUAL_WRAP_GLOSSARY_ID },
  ] as const;
  return steps.map((step) => splitFirstGlossaryMentions(step, terms, used));
}

/** Split Practice 2 so the first automatic-wrap and holding-position mentions become tooltips. */
export function shortRowsPractice2Parts(
  steps: readonly string[] = SHORT_ROWS_PRACTICE_2_STEPS,
): ShortRowsCopyPart[][] {
  const used = new Set<number>();
  const terms = [
    { phrase: "holding position", glossaryId: SHORT_ROWS_HOLDING_POSITION_GLOSSARY_ID },
    { phrase: "automatic wrap", glossaryId: SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID },
  ] as const;
  return steps.map((step) => splitFirstGlossaryMentions(step, terms, used));
}

export function shortRowsPractice2LeadParts(
  lead: string = SHORT_ROWS_PRACTICE_2_LEAD,
): ShortRowsCopyPart[] {
  return splitFirstGlossaryMentions(
    lead,
    [{ phrase: "automatic wrap", glossaryId: SHORT_ROWS_AUTOMATIC_WRAP_GLOSSARY_ID }],
    new Set(),
  );
}

export type ShortRowsSkillBuilder = {
  id: typeof SHORT_ROWS_SKILL_BUILDER_ID;
  title: string;
  subtitle: string;
  introParagraphs: readonly string[];
  whatYoullLearn: readonly string[];
  path: string;
  practiceSetup: readonly string[];
  practice1Heading: string;
  practice1Steps: readonly string[];
  practice2Heading: string;
  practice2Lead: string;
  practice2Steps: readonly string[];
  sueTipHeading: string;
  sueTip: string;
  completionPrompt: string;
  completionOptions: readonly string[];
  video: ShortRowsVideoSlot | null;
};

export function getShortRowsSkillBuilder(): ShortRowsSkillBuilder {
  return {
    id: SHORT_ROWS_SKILL_BUILDER_ID,
    title: SHORT_ROWS_TITLE,
    subtitle: SHORT_ROWS_SUBTITLE,
    introParagraphs: SHORT_ROWS_INTRO_PARAGRAPHS,
    whatYoullLearn: SHORT_ROWS_WHAT_YOULL_LEARN,
    path: SHORT_ROWS_PATH,
    practiceSetup: SHORT_ROWS_PRACTICE_SETUP,
    practice1Heading: SHORT_ROWS_PRACTICE_1_HEADING,
    practice1Steps: SHORT_ROWS_PRACTICE_1_STEPS,
    practice2Heading: SHORT_ROWS_PRACTICE_2_HEADING,
    practice2Lead: SHORT_ROWS_PRACTICE_2_LEAD,
    practice2Steps: SHORT_ROWS_PRACTICE_2_STEPS,
    sueTipHeading: SHORT_ROWS_SUE_TIP_HEADING,
    sueTip: SHORT_ROWS_SUE_TIP,
    completionPrompt: SHORT_ROWS_COMPLETION_PROMPT,
    completionOptions: SHORT_ROWS_COMPLETION_OPTIONS,
    video: shortRowsVideoSlot(),
  };
}
