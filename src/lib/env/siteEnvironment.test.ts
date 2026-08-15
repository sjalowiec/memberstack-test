import { describe, expect, it } from "vitest";
import {
  detectMemberstackMode,
  detectSiteEnvironment,
  isLocalhostStyleHostname,
  memberstackModeLabel,
  shouldShowEnvironmentBanner,
  siteEnvironmentLabel,
} from "./siteEnvironment";

describe("detectSiteEnvironment", () => {
  it("treats the Vite dev server as localhost regardless of host", () => {
    expect(detectSiteEnvironment("example.netlify.app", { isViteDev: true })).toBe(
      "localhost",
    );
  });

  it("detects localhost-style hostnames", () => {
    expect(detectSiteEnvironment("localhost")).toBe("localhost");
    expect(detectSiteEnvironment("127.0.0.1")).toBe("localhost");
    expect(detectSiteEnvironment("0.0.0.0")).toBe("localhost");
    expect(detectSiteEnvironment("mybox.local")).toBe("localhost");
  });

  it("isLocalhostStyleHostname ignores Vite and only checks the host", () => {
    expect(isLocalhostStyleHostname("localhost")).toBe(true);
    expect(isLocalhostStyleHostname("127.0.0.1")).toBe(true);
    expect(isLocalhostStyleHostname("::1")).toBe(true);
    expect(isLocalhostStyleHostname("studio.local")).toBe(true);
    expect(isLocalhostStyleHostname("kin-dev.netlify.app")).toBe(false);
    expect(isLocalhostStyleHostname("knititnow.com")).toBe(false);
  });

  it("always treats *.netlify.app hosts as dev (incl. kin-dev and previews)", () => {
    expect(detectSiteEnvironment("kin-dev.netlify.app")).toBe("dev");
    expect(detectSiteEnvironment("deploy-preview-12--knititnow.netlify.app")).toBe(
      "dev",
    );
    // netlify.app wins even if PUBLIC_SITE_ENV is misconfigured as production.
    expect(
      detectSiteEnvironment("kin-dev.netlify.app", {
        publicSiteEnv: "production",
      }),
    ).toBe("dev");
  });

  it("detects known production hostnames over PUBLIC_SITE_ENV", () => {
    expect(detectSiteEnvironment("knititnow.com")).toBe("production");
    expect(detectSiteEnvironment("www.knititnow.com")).toBe("production");
    expect(detectSiteEnvironment("app.knititnow.com")).toBe("production");
    expect(detectSiteEnvironment("app.knitbymachine.com")).toBe("production");
    expect(detectSiteEnvironment("WWW.KnitItNow.com")).toBe("production");
    expect(
      detectSiteEnvironment("app.knititnow.com", { publicSiteEnv: "dev" }),
    ).toBe("production");
    expect(
      detectSiteEnvironment("www.knititnow.com", { publicSiteEnv: "dev" }),
    ).toBe("production");
  });

  it("uses PUBLIC_SITE_ENV for unknown hosts", () => {
    expect(
      detectSiteEnvironment("staging.example.com", { publicSiteEnv: "production" }),
    ).toBe("production");
    expect(detectSiteEnvironment("staging.example.com")).toBe("dev");
    expect(detectSiteEnvironment("")).toBe("dev");
  });
});

describe("labels + visibility", () => {
  it("labels environments", () => {
    expect(siteEnvironmentLabel("localhost")).toBe("LOCALHOST");
    expect(siteEnvironmentLabel("dev")).toBe("DEV");
    expect(siteEnvironmentLabel("production")).toBe("PRODUCTION");
  });

  it("hides the banner only in production", () => {
    expect(shouldShowEnvironmentBanner("localhost")).toBe(true);
    expect(shouldShowEnvironmentBanner("dev")).toBe(true);
    expect(shouldShowEnvironmentBanner("production")).toBe(false);
  });
});

describe("detectMemberstackMode", () => {
  it("returns unknown when Memberstack is absent", () => {
    expect(detectMemberstackMode(undefined)).toBe("unknown");
    expect(detectMemberstackMode({})).toBe("unknown");
  });

  it("reads a string mode field", () => {
    expect(detectMemberstackMode({ $memberstackDom: { mode: "test" } })).toBe(
      "test",
    );
    expect(
      detectMemberstackMode({ $memberstackDom: { _app: { mode: "LIVE" } } }),
    ).toBe("live");
  });

  it("reads a boolean test flag", () => {
    expect(
      detectMemberstackMode({ $memberstackDom: { _app: { testMode: true } } }),
    ).toBe("test");
    expect(detectMemberstackMode({ $memberstackDom: { test: false } })).toBe(
      "live",
    );
  });

  it("infers from public key shape", () => {
    expect(
      detectMemberstackMode({ $memberstackDom: { publicKey: "pk_test_abc" } }),
    ).toBe("test");
    expect(
      detectMemberstackMode({ $memberstackDom: { _app: { publicKey: "pk_live_xyz" } } }),
    ).toBe("live");
  });

  it("labels modes", () => {
    expect(memberstackModeLabel("test")).toBe("TEST");
    expect(memberstackModeLabel("live")).toBe("LIVE");
    expect(memberstackModeLabel("unknown")).toBe("UNKNOWN");
  });
});
