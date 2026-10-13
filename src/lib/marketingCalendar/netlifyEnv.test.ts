import { describe, expect, it } from "vitest";

import { MarketingCalendarError } from "./errors";
import {
  applyNetlifyActiveCampaignEnv,
  isMaskedNetlifySecret,
  loadNetlifyActiveCampaignEnv,
  loadPreferredActiveCampaignEnv,
  valueFromEnvGet,
} from "./netlifyEnv";

const maskedPreview = `${"*".repeat(16)}wxyz`;

describe("Netlify ActiveCampaign env", () => {
  it("rejects the logged-out placeholder instead of storing it as a credential", () => {
    expect(
      valueFromEnvGet(
        "No value set in the production context for environment variable ACTIVECAMPAIGN_API_KEY",
      ),
    ).toBeNull();
    expect(valueFromEnvGet("{}")).toBeNull();
    expect(valueFromEnvGet('{"ACTIVECAMPAIGN_BASE_URL":"https://example.test"}')).toBe(
      "https://example.test",
    );
    expect(valueFromEnvGet(maskedPreview)).toBeNull();
    expect(valueFromEnvGet(`{"ACTIVECAMPAIGN_API_KEY":"${maskedPreview}"}`)).toBeNull();
    expect(isMaskedNetlifySecret(maskedPreview)).toBe(true);
    expect(isMaskedNetlifySecret("production-key")).toBe(false);
  });

  it("does not read site variables when the CLI is logged out", () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() =>
      loadNetlifyActiveCampaignEnv(env, () => ({
        status: 1,
        stdout: "",
        stderr: "Not logged in. Please log in to see project status.",
      })),
    ).toThrow(MarketingCalendarError);
    expect(env.ACTIVECAMPAIGN_API_KEY).toBeUndefined();
    try {
      loadNetlifyActiveCampaignEnv(env, (args) => {
        if (args[0] === "env:get") {
          return {
            status: 0,
            stdout: "super-secret-token-value-should-not-stick",
            stderr: "",
          };
        }
        return { status: 1, stdout: "", stderr: "Not logged in." };
      });
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain("super-secret-token");
    }
  });

  it("stores a production value only in the supplied env object", () => {
    const env: NodeJS.ProcessEnv = { ACTIVECAMPAIGN_API_KEY: "already-set" };
    const filled = applyNetlifyActiveCampaignEnv(env, {
      statusText: "Current project: knititnow",
      values: {
        ACTIVECAMPAIGN_API_KEY: "different-value",
        ACTIVECAMPAIGN_BASE_URL: "https://example.test",
      },
    });
    expect(filled).toEqual(["ACTIVECAMPAIGN_BASE_URL"]);
    expect(env.ACTIVECAMPAIGN_API_KEY).toBe("already-set");
    expect(env.ACTIVECAMPAIGN_BASE_URL).toBe("https://example.test");
  });

  it("uses an existing API URL when Netlify is logged out and does not keep a fetched secret", () => {
    const env: NodeJS.ProcessEnv = {
      ACTIVECAMPAIGN_API_KEY: "already-present",
      ACTIVECAMPAIGN_API_URL: "https://knitbymachine.api-us1.com/api/3",
    };
    const loaded = loadNetlifyActiveCampaignEnv(env, (args) => {
      if (args[0] === "env:get") {
        return { status: 0, stdout: "super-secret-token-value-should-not-stick", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "Not logged in." };
    });
    expect(loaded.source).toBe("environment");
    expect(env.ACTIVECAMPAIGN_BASE_URL).toBe("https://knitbymachine.api-us1.com");
    expect(env.ACTIVECAMPAIGN_API_KEY).toBe("already-present");
    expect(JSON.stringify(env)).not.toContain("super-secret-token");
  });

  it("uses production Netlify values instead of a key already in the environment", () => {
    const env: NodeJS.ProcessEnv = {
      ACTIVECAMPAIGN_API_KEY: "stale-local-key",
      ACTIVECAMPAIGN_API_URL: "https://knitbymachine.api-us1.com/",
    };
    const loaded = loadPreferredActiveCampaignEnv(env, (args) => {
      if (args[0] === "status") return { status: 0, stdout: "Current project: knititnow", stderr: "" };
      if (args[1] === "ACTIVECAMPAIGN_API_KEY") {
        return { status: 0, stdout: "production-key", stderr: "" };
      }
      return { status: 0, stdout: "https://knititnow.api-us1.com", stderr: "" };
    });
    expect(loaded.source).toBe("netlify");
    expect(env.ACTIVECAMPAIGN_API_KEY).toBe("production-key");
    expect(env.ACTIVECAMPAIGN_BASE_URL).toBe("https://knititnow.api-us1.com");
  });

  it("rejects a masked Netlify secret before any later request can use it", () => {
    const env: NodeJS.ProcessEnv = {
      ACTIVECAMPAIGN_API_KEY: "stale-local-key",
      ACTIVECAMPAIGN_API_URL: "https://knitbymachine.api-us1.com/",
    };
    expect(() =>
      loadPreferredActiveCampaignEnv(env, (args) => {
        if (args[0] === "status") return { status: 0, stdout: "Current project: knititnow", stderr: "" };
        if (args[1] === "ACTIVECAMPAIGN_API_KEY") return { status: 0, stdout: `${maskedPreview}\n`, stderr: "" };
        return { status: 0, stdout: "https://knititnow.api-us1.com", stderr: "" };
      }),
    ).toThrow(/masked ActiveCampaign API key/);
    expect(env.ACTIVECAMPAIGN_API_KEY).toBe("stale-local-key");
    expect(JSON.stringify(env)).not.toContain("*");
    expect(JSON.stringify(env)).not.toContain(maskedPreview);
  });
});
