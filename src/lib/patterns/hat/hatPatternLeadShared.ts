/**
 * Shared copy and limits for free Hat Pattern lead capture.
 * Safe for browser + server. Never includes ActiveCampaign credentials or tag IDs.
 */

/** Human-readable ActiveCampaign tag; resolved to an ID server-side by name. */
export const HAT_PATTERN_LEAD_TAG = "lead: Hat Pattern";

export const HAT_PATTERN_LEAD_ENDPOINT = "/api/hat-pattern-lead";

export const HAT_PATTERN_LEAD_MAX_EMAIL = 254;
export const HAT_PATTERN_LEAD_MAX_FIRST_NAME = 80;

export const HAT_PATTERN_LEAD_MESSAGES = {
  success: "Your Hat Pattern is ready.",
  genericFailure:
    "We couldn’t save your email right now. Please try again in a moment.",
  invalidEmail: "Please enter a valid email address.",
  fieldTooLong: "Please shorten your email address and try again.",
} as const;

export const HAT_PATTERN_LEAD_TITLE = "Your free Hat Pattern is ready";
export const HAT_PATTERN_LEAD_COPY =
  "Enter your email to view your finished custom Hat Pattern.";
export const HAT_PATTERN_LEAD_SUBMIT_LABEL = "VIEW MY PATTERN";
export const HAT_PATTERN_LEAD_HELPER = "Free. No membership required.";
