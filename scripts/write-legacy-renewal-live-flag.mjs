import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// netlify.toml variables are available while the site builds, not while the
// scheduled function runs. Bake the production flag into the module Netlify bundles.
if (process.env.NETLIFY === "true") {
  const enabled = process.env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true";
  const target = join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/lib/watson/legacyRenewalReminderLiveFlag.ts",
  );
  writeFileSync(
    target,
    `/**
 * Production builds overwrite the boolean from LEGACY_RENEWAL_REMINDER_LIVE_ENABLED.
 * The scheduled function cannot read that variable from netlify.toml at runtime.
 * kin-dev stays dry-run because live tags also require the production site.
 */
export const LEGACY_RENEWAL_REMINDER_LIVE_BUILD_FLAG = ${enabled};

export function legacyRenewalReminderLiveEnabled(
  env: { LEGACY_RENEWAL_REMINDER_LIVE_ENABLED?: string } = process.env,
): boolean {
  return (
    env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true" ||
    LEGACY_RENEWAL_REMINDER_LIVE_BUILD_FLAG
  );
}
`,
  );
}
