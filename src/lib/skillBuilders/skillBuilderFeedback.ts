/**
 * Shared Skill Builder practice feedback (reactions).
 *
 * Stable IDs are independent of route slugs so reporting stays consistent
 * if a public path later changes. Contact is the existing /contact page —
 * no new messaging system and no automatic email to Sue.
 */
import { E_WRAP_CAST_ON_PATH, E_WRAP_CAST_ON_SKILL_BUILDER_ID, E_WRAP_CAST_ON_TITLE } from "./eWrapCastOnSkillBuilder";
import {
  JOINING_SHOULDER_SEAMS_PATH,
  JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID,
  JOINING_SHOULDER_SEAMS_TITLE,
} from "./joiningShoulderSeamsSkillBuilder";
import { ROUND_NECKLINE_SKILL_BUILDERS } from "./roundNecklineSkillBuilders";
import { SHORT_ROWS_PATH, SHORT_ROWS_SKILL_BUILDER_ID, SHORT_ROWS_TITLE } from "./shortRowsSkillBuilder";

export const SKILL_BUILDER_REACTION_CONTENT_TYPE = "skill-builder" as const;

export const SKILL_BUILDER_FEEDBACK_HEADING = "How did this practice go?";

export const SKILL_BUILDER_FEEDBACK_CONTACT_HREF = "/contact";

export const SKILL_BUILDER_FEEDBACK_HELP_COPY =
  "What was confusing? Send Sue your question and tell her where you got stuck.";

export const SKILL_BUILDER_FEEDBACK_CONTACT_LABEL = "Ask Sue a Question";

export const SKILL_BUILDER_FEEDBACK_THANKS = "Thanks! Your response was saved.";

export const SKILL_BUILDER_FEEDBACK_SAVE_ERROR =
  "We couldn’t save your response. Please try again.";

export const SKILL_BUILDER_REACTIONS = [
  {
    id: "did_it",
    label: "I did it",
    emoji: "👍",
  },
  {
    id: "will_try",
    label: "I’m going to try it",
    emoji: "🙂",
  },
  {
    id: "need_help",
    label: "I need more help",
    emoji: "💡",
  },
] as const;

export type SkillBuilderReactionId = (typeof SKILL_BUILDER_REACTIONS)[number]["id"];

export type SkillBuilderFeedbackConfig = {
  /** Existing Skill Builder module / `data-sb-builder` id. */
  builderId: string;
  /** Stable reaction-reporting id. */
  id: string;
  title: string;
  path: string;
  memberOnly: boolean;
  /** Hide the shared back link when the page already has a different footer CTA. */
  includeBackLink: boolean;
};

export const SKILL_BUILDER_FEEDBACK_CATALOG: readonly SkillBuilderFeedbackConfig[] = [
  {
    builderId: ROUND_NECKLINE_SKILL_BUILDERS["round-neckline-basics"].id,
    id: "skill-builder-round-neckline-straight-shoulders",
    title: ROUND_NECKLINE_SKILL_BUILDERS["round-neckline-basics"].title,
    path: ROUND_NECKLINE_SKILL_BUILDERS["round-neckline-basics"].path,
    memberOnly: false,
    includeBackLink: true,
  },
  {
    builderId: ROUND_NECKLINE_SKILL_BUILDERS["round-necklines-shaped-shoulders"].id,
    id: "skill-builder-round-neckline-shaped-shoulders",
    title: ROUND_NECKLINE_SKILL_BUILDERS["round-necklines-shaped-shoulders"].title,
    path: ROUND_NECKLINE_SKILL_BUILDERS["round-necklines-shaped-shoulders"].path,
    memberOnly: true,
    includeBackLink: true,
  },
  {
    builderId: JOINING_SHOULDER_SEAMS_SKILL_BUILDER_ID,
    id: "skill-builder-shoulder-seams",
    title: JOINING_SHOULDER_SEAMS_TITLE,
    path: JOINING_SHOULDER_SEAMS_PATH,
    memberOnly: true,
    includeBackLink: false,
  },
  {
    builderId: E_WRAP_CAST_ON_SKILL_BUILDER_ID,
    id: "skill-builder-e-wrap-cast-on",
    title: E_WRAP_CAST_ON_TITLE,
    path: E_WRAP_CAST_ON_PATH,
    memberOnly: true,
    includeBackLink: true,
  },
  {
    builderId: SHORT_ROWS_SKILL_BUILDER_ID,
    id: "skill-builder-short-rows",
    title: SHORT_ROWS_TITLE,
    path: SHORT_ROWS_PATH,
    memberOnly: true,
    includeBackLink: true,
  },
];

export function isSkillBuilderReactionId(value: unknown): value is SkillBuilderReactionId {
  return SKILL_BUILDER_REACTIONS.some((reaction) => reaction.id === value);
}

export function getSkillBuilderFeedbackConfig(
  builderId: string,
): SkillBuilderFeedbackConfig | null {
  return SKILL_BUILDER_FEEDBACK_CATALOG.find((item) => item.builderId === builderId) ?? null;
}

export function getSkillBuilderFeedbackByReactionId(
  reactionId: string,
): SkillBuilderFeedbackConfig | null {
  return SKILL_BUILDER_FEEDBACK_CATALOG.find((item) => item.id === reactionId) ?? null;
}

export function isSkillBuilderFeedbackId(value: unknown): value is string {
  return typeof value === "string" && SKILL_BUILDER_FEEDBACK_CATALOG.some((item) => item.id === value);
}
