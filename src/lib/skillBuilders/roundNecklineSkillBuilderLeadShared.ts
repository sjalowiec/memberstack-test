/**
 * Shared copy and limits for the free Round Neckline Skill Builder lead capture.
 * Safe for browser + server. Never includes ActiveCampaign credentials or tag IDs.
 */

/** Human-readable ActiveCampaign tag; resolved to an ID server-side by name. */
export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG =
  "Lead: Skill Builder";

export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_ENDPOINT =
  "/api/skill-builder-round-neckline-lead";

export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_EMAIL = 254;
export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_FIRST_NAME = 80;

export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES = {
  success: "Your practice instructions are ready.",
  genericFailure:
    "We couldn’t save your email right now. Please try again in a moment.",
  invalidEmail: "Please enter a valid email address.",
  fieldTooLong: "Please shorten your email address and try again.",
} as const;
