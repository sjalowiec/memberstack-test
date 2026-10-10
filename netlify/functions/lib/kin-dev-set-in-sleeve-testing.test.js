import { afterEach, describe, expect, it } from "vitest";
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";
import {
  isKinDevSetInSleeveTestRequest,
  isSetInSleeveProjectRecord,
  kinDevSetInSleeveTestIdentity,
  KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
  setInSleeveDevTestWriteError,
} from "./kin-dev-set-in-sleeve-testing.js";

const KIN_DEV_ENV = {
  SITE_NAME: "kin-dev",
  SITE_ID: "3196ab5e-c5a1-4cd4-a13a-980523087e9a",
  URL: "https://kin-dev.netlify.app",
  CONTEXT: "production",
  NODE_ENV: "production",
  ALLOW_DEV_PATTERN_USER: "true",
  PUBLIC_ALLOW_DEV_PATTERN_USER: "true",
};

const PRODUCTION_ENV = {
  SITE_NAME: "knititnow",
  SITE_ID: "production-site-id",
  URL: "https://knititnow.com",
  CONTEXT: "production",
  NODE_ENV: "production",
  ALLOW_DEV_PATTERN_USER: "true",
  PUBLIC_ALLOW_DEV_PATTERN_USER: "true",
};

function request({
  url = "https://kin-dev.netlify.app/.netlify/functions/custom-pattern-project-save?allowDev=1&setInDevTest=1",
  host = "kin-dev.netlify.app",
  header = "1",
  devUserId = "mem_someone_else",
} = {}) {
  const headers = { host };
  if (header !== null) headers["x-kbm-set-in-dev-test"] = header;
  if (devUserId) headers["x-kbm-dev-user-id"] = devUserId;
  return new Request(url, { method: "POST", headers });
}

const setInProject = {
  pattern: {
    patternType: "sleeveless",
    style: { construction: "set-in-sleeve", constructionAuthored: "set-in-sleeve" },
  },
  customOverrides: {},
};

const dropShoulderProject = {
  pattern: {
    patternType: "sleeveless",
    style: { construction: "drop-shoulder", constructionAuthored: "drop-shoulder" },
  },
  customOverrides: {},
};

const previousEnv = {};

afterEach(() => {
  for (const key of Object.keys(previousEnv)) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
    delete previousEnv[key];
  }
});

describe("kin-dev set-in sleeve test access", () => {
  it("allows the fixed test identity on kin-dev and ignores the client-chosen user id", () => {
    const identity = kinDevSetInSleeveTestIdentity(request(), KIN_DEV_ENV);
    expect(identity).toEqual({
      ok: true,
      userId: KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
      mode: "dev",
      devTest: "set-in-sleeve",
    });
    expect(identity.userId).not.toBe("mem_someone_else");
  });

  it("allows a kin-dev deploy-preview host", () => {
    expect(
      isKinDevSetInSleeveTestRequest(
        request({ host: "deploy-preview-42--kin-dev.netlify.app" }),
        KIN_DEV_ENV,
      ),
    ).toBe(true);
  });

  it("stays off on production even with the header, a spoofed host, query flags, and env flags", () => {
    expect(
      isKinDevSetInSleeveTestRequest(
        request({
          url: "https://knititnow.com/patterns/set-in-sleeve/builder?allowDev=1&PUBLIC_ALLOW_DEV_PATTERN_USER=true",
          host: "kin-dev.netlify.app",
        }),
        PRODUCTION_ENV,
      ),
    ).toBe(false);
    expect(kinDevSetInSleeveTestIdentity(request({ host: "kin-dev.netlify.app" }), PRODUCTION_ENV)).toBe(
      null,
    );
  });

  it("stays off on kin-dev when the request host is the production site", () => {
    expect(isKinDevSetInSleeveTestRequest(request({ host: "knititnow.com" }), KIN_DEV_ENV)).toBe(false);
    expect(isKinDevSetInSleeveTestRequest(request({ host: "www.knititnow.com" }), KIN_DEV_ENV)).toBe(
      false,
    );
  });

  it("does not treat a query parameter or a lookalike host as the switch", () => {
    expect(
      isKinDevSetInSleeveTestRequest(
        request({ header: null, url: "https://kin-dev.netlify.app/save?x-kbm-set-in-dev-test=1" }),
        KIN_DEV_ENV,
      ),
    ).toBe(false);
    expect(
      isKinDevSetInSleeveTestRequest(request({ host: "notkin-dev.netlify.app" }), KIN_DEV_ENV),
    ).toBe(false);
    expect(
      isKinDevSetInSleeveTestRequest(request({ host: "kin-dev.netlify.app.evil.com" }), KIN_DEV_ENV),
    ).toBe(false);
  });

  it("does not let ALLOW_DEV_PATTERN_USER open production", () => {
    previousEnv.CONTEXT = process.env.CONTEXT;
    previousEnv.NODE_ENV = process.env.NODE_ENV;
    previousEnv.ALLOW_DEV_PATTERN_USER = process.env.ALLOW_DEV_PATTERN_USER;
    process.env.CONTEXT = "production";
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    expect(isAllowDevPatternUser()).toBe(false);
  });

  it("writes only set-in sleeve projects for the test identity", () => {
    const access = { devTest: "set-in-sleeve" };
    expect(isSetInSleeveProjectRecord(setInProject)).toBe(true);
    expect(setInSleeveDevTestWriteError(access, setInProject)).toBeNull();
    expect(setInSleeveDevTestWriteError(access, dropShoulderProject)).toMatch(/Set-In Sleeve/);
    expect(setInSleeveDevTestWriteError({ mode: "member" }, dropShoulderProject)).toBeNull();
  });
});
