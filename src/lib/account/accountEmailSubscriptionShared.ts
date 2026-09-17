/**
 * Account-page email-list copy and status keys. Safe for browser + server.
 * Never includes ActiveCampaign credentials, list IDs, or contact IDs.
 */

export const ACCOUNT_EMAIL_SUBSCRIPTION_TAG = "resubscribed-account-page";

export const ACCOUNT_EMAIL_SUBSCRIPTION_HEADING = "Email updates";

export const ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT =
  "By clicking this button, you’re asking Knit It Now to send marketing emails to the email address on your account. You can unsubscribe at any time.";

export const ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL = "Start Receiving Emails";

export const ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES = {
  receiving: "You’re receiving Knit It Now emails.",
  notReceiving: "You’re not currently receiving Knit It Now emails.",
  nowSubscribed: "You’re now subscribed to Knit It Now emails.",
  unconfirmed:
    "This email address is still waiting for confirmation, so it isn’t receiving Knit It Now emails yet.",
  bounced:
    "This email address can’t receive Knit It Now emails right now. Please contact us if you need help.",
  unavailable:
    "We couldn’t check your email status right now. Please try again in a moment.",
  missingEmail:
    "We couldn’t confirm the email address on your account. Please refresh the page and try again.",
  genericFailure:
    "We couldn’t update your email preference right now. Please try again in a moment.",
  bouncedBlocked:
    "This email address can’t receive Knit It Now emails right now. Please contact us if you need help.",
} as const;

/**
 * List / contact states the Account page can display.
 * `unavailable` covers config errors and ActiveCampaign request failures.
 */
export type AccountEmailSubscriptionState =
  | "active"
  | "unsubscribed"
  | "unconfirmed"
  | "bounced"
  | "not_found"
  | "not_on_list"
  | "unknown"
  | "unavailable";

/** Explicit resubscribe is allowed except for active, bounced/suppressed, or unknown-check failures. */
export function canResubscribeFromState(state: AccountEmailSubscriptionState): boolean {
  if (state === "active" || state === "bounced" || state === "unavailable") {
    return false;
  }
  return true;
}
