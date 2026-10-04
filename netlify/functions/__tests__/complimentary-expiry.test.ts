import { describe, expect, it } from "vitest";

import {
  complimentaryExpiryWillDryRun,
  isComplimentaryExpiryLiveRuntime,
  isComplimentaryScheduledLiveEnabled,
  PRODUCTION_COMPLIMENTARY_EXPIRY_SITE_ID,
} from "../complimentary-expiry";
import { resolveExpiryExecution } from "../legacy-annual-expiry";

const KIN_DEV_SITE_ID = "3196ab5e-c5a1-4cd4-a13a-980523087e9a";

function productionEnv(flag: string | undefined): NodeJS.ProcessEnv {
  return {
    CONTEXT: "production",
    SITE_ID: PRODUCTION_COMPLIMENTARY_EXPIRY_SITE_ID,
    SITE_NAME: "knititnow",
    URL: "https://knititnow.com",
    ...(flag === undefined ? {} : { COMPLIMENTARY_EXPIRY_LIVE_ENABLED: flag }),
  };
}

function kinDevEnv(): NodeJS.ProcessEnv {
  return {
    CONTEXT: "production",
    SITE_ID: KIN_DEV_SITE_ID,
    SITE_NAME: "kin-dev",
    URL: "https://kin-dev.netlify.app",
    COMPLIMENTARY_EXPIRY_LIVE_ENABLED: "true",
  };
}

describe("complimentary expiry live runtime", () => {
  it("allows only the production site when the flag is exactly true", () => {
    const env = productionEnv("true");
    expect(isComplimentaryScheduledLiveEnabled(env)).toBe(true);
    expect(isComplimentaryExpiryLiveRuntime(env)).toBe(true);
    const decision = resolveExpiryExecution({
      scheduled: true,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: null,
      liveEnabled: true,
    });
    expect(complimentaryExpiryWillDryRun(env, decision)).toBe(false);
  });

  it("keeps a production scheduled run dry when the flag is missing or not exact", () => {
    for (const flag of [undefined, "false", "TRUE", "1"]) {
      const env = productionEnv(flag);
      const decision = resolveExpiryExecution({
        scheduled: true,
        confirmLive: false,
        providedSecret: null,
        configuredSecret: null,
        liveEnabled: isComplimentaryScheduledLiveEnabled(env) && isComplimentaryExpiryLiveRuntime(env),
      });
      expect(complimentaryExpiryWillDryRun(env, decision)).toBe(true);
    }
  });

  it("keeps kin-dev dry even when the flag is true and CONTEXT is production", () => {
    const env = kinDevEnv();
    expect(isComplimentaryExpiryLiveRuntime(env)).toBe(false);
    const scheduled = resolveExpiryExecution({
      scheduled: true,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: null,
      liveEnabled: false,
    });
    expect(complimentaryExpiryWillDryRun(env, scheduled)).toBe(true);

    const manual = resolveExpiryExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: "secret",
      configuredSecret: "secret",
      liveEnabled: true,
    });
    expect(manual.authorized).toBe(true);
    if (manual.authorized) expect(manual.dryRun).toBe(false);
    expect(complimentaryExpiryWillDryRun(env, manual)).toBe(true);
  });

  it("keeps an unknown site and a missing site id dry", () => {
    expect(
      isComplimentaryExpiryLiveRuntime({
        CONTEXT: "production",
        SITE_ID: "someone-else",
        COMPLIMENTARY_EXPIRY_LIVE_ENABLED: "true",
      }),
    ).toBe(false);
    expect(
      isComplimentaryExpiryLiveRuntime({
        CONTEXT: "production",
        COMPLIMENTARY_EXPIRY_LIVE_ENABLED: "true",
      }),
    ).toBe(false);
  });
});
