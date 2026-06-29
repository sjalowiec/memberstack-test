/**
 * Quick Help Session ù one-time purchase via Memberstack.
 * Do not hard-code these IDs elsewhere.
 *
 * Production checklist (admin/developer):
 * - Memberstack controls whether checkout is Test or Live mode (dashboard toggle, not this file).
 * - memberstackPlanId and memberstackPriceId must come from the Memberstack environment in use
 *   (Test-mode IDs differ from Live-mode IDs ù copy from the matching dashboard mode).
 * - Before production: confirm Memberstack is in LIVE mode.
 * - Confirm the Quick Help product uses the live Knit It Now Stripe account.
 * - Confirm the $49 price exists in live mode.
 * - Confirm the plan success redirect in Memberstack matches tidycalUrl (Quick Help appointment calendar).
 * - TidyCal appointment calendar payment must be OFF; payment is collected via Memberstack/Stripe.
 *
 * Post-checkout redirect (current behavior):
 * - quickHelpCheckout.ts passes successUrl: tidycalUrl to Memberstack checkout.
 * - If Memberstack honors that URL, the browser goes directly to TidyCal after payment.
 * - Memberstack may still redirect to schedulePath first (e.g. plan-level success URL in the
 *   dashboard). schedule.astro detects fromCheckout=true and immediately forwards to tidycalUrl.
 * - schedulePath remains a backup route for manual access (entitlement-gated embedded calendar).
 */
export const QUICK_HELP_SESSION = {
  name: "Quick Help Session (15 minutes)",
  price: 49,
  memberstackPlanId: "pln_quick-help-session-15-minutes--86hf0cyv",
  memberstackPriceId: "prc_quick-help-session-15-minutes--peh80vgq",
  landingPath: "/help-hub/quick-help",
  schedulePath: "/help-hub/quick-help/schedule",
  tidycalUrl: "https://tidycal.com/quick-help/quick-help-session",
  tidycalEmbedUrl: "https://tidycal.com/quick-help/quick-help-session?embed=1",
} as const;
