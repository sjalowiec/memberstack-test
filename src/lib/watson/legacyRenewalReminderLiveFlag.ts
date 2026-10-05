/**
 * Production builds overwrite the boolean from LEGACY_RENEWAL_REMINDER_LIVE_ENABLED.
 * The scheduled function cannot read that variable from netlify.toml at runtime.
 * kin-dev stays dry-run because live tags also require the production site.
 */
export const LEGACY_RENEWAL_REMINDER_LIVE_BUILD_FLAG = false;

export function legacyRenewalReminderLiveEnabled(
  env: { LEGACY_RENEWAL_REMINDER_LIVE_ENABLED?: string } = process.env,
): boolean {
  return (
    env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true" ||
    LEGACY_RENEWAL_REMINDER_LIVE_BUILD_FLAG
  );
}
