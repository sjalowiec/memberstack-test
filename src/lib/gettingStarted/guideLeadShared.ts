/**
 * Copy and limits for the Getting Started Guide email gate.
 * Safe for the browser and the server. No ActiveCampaign ids or credentials.
 * The mailing list id comes from ACTIVECAMPAIGN_KIN_LIST_ID at request time.
 * The lead tag is resolved by this exact name; the tag id is never hardcoded.
 */

export const GETTING_STARTED_GUIDE_LEAD_TAG = "Lead: Getting Started Guide";

export const GETTING_STARTED_GUIDE_SIGNUP_SOURCE = "getting-started-guide";

export const GETTING_STARTED_GUIDE_LEAD_ENDPOINT = "/api/getting-started-guide-lead";

/** Browser recognition key. Timestamp only — never a name or email. */
export const GETTING_STARTED_GUIDE_STORAGE_KEY = "kin:getting-started-guide-at";

export const GETTING_STARTED_GUIDE_MESSAGES = {
  success: "Your guide is ready.",
  genericFailure:
    "We couldn’t open the guide just now. Please try again in a moment.",
  invalidFirstName: "Please enter your first name.",
  invalidEmail: "Please enter a valid email address.",
  fieldTooLong: "Please shorten your entries and try again.",
} as const;
