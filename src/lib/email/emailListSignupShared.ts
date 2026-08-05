/** Shared copy and limits for email list signup (safe for browser + server). */

export const EMAIL_LIST_SIGNUP_SOURCE_TAG = "source-website-weekly-tips";

/** Reporting source key for Tip of the Week signups (safe for browser + server). */
export const EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK = "tip-of-the-week";

export const EMAIL_LIST_SIGNUP_MAX_FIRST_NAME = 80;
export const EMAIL_LIST_SIGNUP_MAX_EMAIL = 254;

export const EMAIL_LIST_SIGNUP_MESSAGES = {
  subscribed:
    "You’re on the list! Watch your inbox for the next Tip of the Week.",
  already:
    "You’re all set! Watch your inbox for the next Tip of the Week.",
  genericFailure:
    "We couldn’t complete your signup right now. Please try again in a moment.",
  invalidFirstName: "Please enter your first name.",
  invalidEmail: "Please enter a valid email address.",
  fieldTooLong: "Please shorten your entries and try again.",
} as const;
