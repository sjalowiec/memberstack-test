import {
  joiningShoulderSeamsVideoSlot,
  type JoiningShoulderSeamsVideoSlot,
} from "./joiningShoulderSeamsSkillBuilderVideos";

export const JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID = "join-beautiful-shoulder-seams";

export const JOINING_SHOULDER_SEAMS_PATH =
  "/learn/skill-builders/join-beautiful-shoulder-seams";

export const JOINING_SHOULDER_SEAMS_TITLE = "Join Beautiful Shoulder Seams";

export const JOINING_SHOULDER_SEAMS_INTRO =
  "Create a neat, stable shoulder seam directly on your knitting machine, similar to a hand knitting 3-needle bind off.";

export const JOINING_SHOULDER_SEAMS_WHAT_YOULL_PRACTICE =
  "Rehang the front and back shoulder stitches, pull the stitches together through the needle hooks, and bind off a tidy, stable shoulder seam.";

export const JOINING_SHOULDER_SEAMS_CATALOG_SUBTITLE =
  "Rehang live front and back shoulder stitches and bind them off together.";

export const JOINING_SHOULDER_SEAMS_CHECKLIST: readonly string[] = [
  "Remove the shoulder stitches on waste yarn, leaving a tail at least three times the width of the shoulder seam.",
  "With the public side facing you, rehang the back shoulder stitches. Check that every stitch is on a needle, then push the stitches behind the latches.",
  "With the private side facing you, rehang the matching front shoulder stitches, leaving each stitch in the hook.",
  "Close the latches and carefully push the needles back, pulling each front stitch through its matching back stitch with the yarn tail.",
  "Bind off using your preferred method.",
  "Repeat for the second shoulder.",
];

export const JOINING_SHOULDER_SEAMS_PUBLIC_SIDE_GLOSSARY_ID = 322;
export const JOINING_SHOULDER_SEAMS_PRIVATE_SIDE_GLOSSARY_ID = 323;
export const JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID = 522;
export const JOINING_SHOULDER_SEAMS_THREE_NEEDLE_PHRASE = "3-needle bind off";

export const JOINING_SHOULDER_SEAMS_RELATED_PRACTICE = {
  href: "/learn/skill-builders/round-neckline-basics",
  eyebrow: "RELATED SKILL BUILDER",
  title: "Shape a Round Neckline",
  supportingText:
    "Practice the neckline shaping that comes before you join the shoulders.",
} as const;

const GLOSSARY_PHRASES = [
  { phrase: "public side", glossaryId: JOINING_SHOULDER_SEAMS_PUBLIC_SIDE_GLOSSARY_ID },
  { phrase: "private side", glossaryId: JOINING_SHOULDER_SEAMS_PRIVATE_SIDE_GLOSSARY_ID },
] as const;

export type JoiningShoulderSeamsCopyPart =
  | { type: "text"; text: string }
  | { type: "glossary"; glossaryId: number; text: string };

export type JoiningShoulderSeamsChecklistPart = JoiningShoulderSeamsCopyPart;

/** Split the intro so only “3-needle bind off” becomes a glossary tooltip. */
export function joiningShoulderSeamsIntroParts(
  intro: string = JOINING_SHOULDER_SEAMS_INTRO,
): JoiningShoulderSeamsCopyPart[] {
  const phrase = JOINING_SHOULDER_SEAMS_THREE_NEEDLE_PHRASE;
  const index = intro.toLowerCase().indexOf(phrase);
  if (index < 0) return [{ type: "text", text: intro }];
  const parts: JoiningShoulderSeamsCopyPart[] = [];
  if (index > 0) {
    parts.push({ type: "text", text: intro.slice(0, index) });
  }
  parts.push({
    type: "glossary",
    glossaryId: JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID,
    text: intro.slice(index, index + phrase.length),
  });
  const after = intro.slice(index + phrase.length);
  if (after.length > 0) {
    parts.push({ type: "text", text: after });
  }
  return parts;
}

/** Split checklist copy so only the first public-side and first private-side mentions become tooltips. */
export function joiningShoulderSeamsChecklistParts(
  steps: readonly string[] = JOINING_SHOULDER_SEAMS_CHECKLIST,
): JoiningShoulderSeamsChecklistPart[][] {
  const used = new Set<number>();
  return steps.map((step) => {
    const parts: JoiningShoulderSeamsChecklistPart[] = [];
    let remaining = step;
    while (remaining.length > 0) {
      let next: { index: number; glossaryId: number; text: string } | null = null;
      for (const term of GLOSSARY_PHRASES) {
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
  });
}

export type JoiningShoulderSeamsSkillBuilder = {
  id: typeof JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID;
  title: string;
  intro: string;
  whatYoullPractice: string;
  path: string;
  checklist: readonly string[];
  video: JoiningShoulderSeamsVideoSlot | null;
};

export function getJoiningShoulderSeamsSkillBuilder(): JoiningShoulderSeamsSkillBuilder {
  return {
    id: JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID,
    title: JOINING_SHOULDER_SEAMS_TITLE,
    intro: JOINING_SHOULDER_SEAMS_INTRO,
    whatYoullPractice: JOINING_SHOULDER_SEAMS_WHAT_YOULL_PRACTICE,
    path: JOINING_SHOULDER_SEAMS_PATH,
    checklist: JOINING_SHOULDER_SEAMS_CHECKLIST,
    video: joiningShoulderSeamsVideoSlot(),
  };
}
