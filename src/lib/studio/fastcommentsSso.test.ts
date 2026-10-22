import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  STUDIO_COMMENTS_POC_API,
  STUDIO_COMMENTS_POC_PAGE,
  STUDIO_FASTCOMMENTS_URL_ID,
  STUDIO_LOCAL_TEST_POST_ID,
  STUDIO_LOCAL_TEST_POST_TITLE,
  STUDIO_LOCAL_TEST_VIMEO_ID,
  isManagedStudioSessionRoute,
  isStudioCommentsPocProductionBlocked,
  isStudioCommentsPocRoute,
  studioDiscussionId,
  studioPrivateMessageHref,
} from "./fastcommentsPocAccess";
import { buildSecureSsoWidgetUser, studioCommentIdentityFromMemberRecord } from "./fastcommentsSso";
import { handleStudioFastcommentsSso } from "./fastcommentsSsoRequest";
import {
  studioCommentLoginVisible,
  studioCommentStatusMessage,
  studioFastcommentsBaseConfig,
  studioWidgetDiscussionId,
} from "./fastcommentsWidgetClient";
import type { StudioCommentSession } from "./fastcommentsWidgetClient";

const SECRET = "test-secret";

describe("studio comment names", () => {
  it("uses custom first and last name fields", () => {
    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "sue.hall@example.com", firstName: "Other", lastName: "Name" },
        customFields: { "first-name": "Sue", "last-name": "Jalowiec" },
      }),
    ).toEqual({ email: "sue.hall@example.com", displayName: "Sue J." });
  });

  it("uses the first name alone when there is no last name", () => {
    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "mary@example.com" },
        customFields: { "first-name": "Mary" },
      }).displayName,
    ).toBe("Mary");
  });

  it("falls back to auth first and last name, never the email local-part", () => {
    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "mary.lee@example.com", firstName: " Mary ", lastName: "Lee" },
        customFields: {},
      }).displayName,
    ).toBe("Mary L.");

    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "sue.hall@example.com" },
        customFields: {},
      }).displayName,
    ).toBeNull();
  });

  it("blocks posting when there is a last name but no first name", () => {
    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "lee@example.com", lastName: "Lee" },
        customFields: { "last-name": "Lee" },
      }).displayName,
    ).toBeNull();
    expect(
      studioCommentIdentityFromMemberRecord({
        id: "mem_sb_ada",
        auth: { email: "ada@example.com" },
        customFields: { name: "Ada Lovelace" },
      }).displayName,
    ).toBeNull();
  });

  it("rejects an email stored in the name field", () => {
    expect(
      studioCommentIdentityFromMemberRecord({
        auth: { email: "pat@example.com" },
        customFields: { name: "pat@example.com" },
      }).displayName,
    ).toBeNull();
  });
});

describe("secure SSO payload", () => {
  it("signs timestamp plus the base64 user JSON and keeps the secret out of the payload", () => {
    const sso = buildSecureSsoWidgetUser({
      id: "mem_sb_1",
      email: "ada@example.com",
      displayName: "Ada L.",
      apiSecret: SECRET,
      timestamp: 1700000000000,
    });

    const decoded = JSON.parse(Buffer.from(sso.userDataJSONBase64, "base64").toString("utf8"));
    expect(decoded).toEqual({
      id: "mem_sb_1",
      email: "ada@example.com",
      username: "Ada L.",
      displayName: "Ada L.",
    });
    expect(decoded.username).toBe("Ada L.");
    expect(JSON.stringify(decoded)).not.toContain("Lovelace");
    expect(decoded.username).not.toContain("@");
    expect(sso.timestamp).toBe(1700000000000);
    expect(sso.verificationHash).toBe(
      "1b39daf34b9c8391641acdcd1a07503af43d336dc2bcae83bf8299453107eb0e",
    );
    expect(JSON.stringify(sso)).not.toContain(SECRET);
    expect(JSON.stringify(sso)).not.toContain("simpleSSO");
  });
});

describe("studio comment proof access", () => {
  it("matches only the test page and its SSO endpoint", () => {
    expect(isStudioCommentsPocRoute(STUDIO_COMMENTS_POC_PAGE)).toBe(true);
    expect(isStudioCommentsPocRoute(`${STUDIO_COMMENTS_POC_API}/`)).toBe(true);
    expect(isStudioCommentsPocRoute("/studio")).toBe(false);
    expect(isStudioCommentsPocRoute("/")).toBe(false);
    expect(isManagedStudioSessionRoute("/studio/shoulder-shaping")).toBe(true);
    expect(isManagedStudioSessionRoute("/studio/comments-test")).toBe(false);
    expect(isManagedStudioSessionRoute("/watson/studio")).toBe(false);
  });

  it("sends a private message through the contact page with the post title and path", () => {
    const href = studioPrivateMessageHref({
      title: STUDIO_LOCAL_TEST_POST_TITLE,
      path: STUDIO_COMMENTS_POC_PAGE,
    });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/contact/");
    expect(url.searchParams.get("subject")).toBe(
      `Sue's Studio: ${STUDIO_LOCAL_TEST_POST_TITLE} (${STUDIO_COMMENTS_POC_PAGE})`,
    );
    expect(url.searchParams.get("page")).toBe(STUDIO_COMMENTS_POC_PAGE);
    expect(href).not.toContain(STUDIO_LOCAL_TEST_VIMEO_ID);
  });

  it("ties the discussion to the Studio post id, not the Vimeo id", () => {
    expect(studioDiscussionId(STUDIO_LOCAL_TEST_POST_ID)).toBe("studio-post:local-sues-studio-test");
    expect(STUDIO_FASTCOMMENTS_URL_ID).toBe("studio-post:local-sues-studio-test");
    expect(STUDIO_FASTCOMMENTS_URL_ID).not.toContain(STUDIO_LOCAL_TEST_VIMEO_ID);
    expect(() => studioDiscussionId(STUDIO_LOCAL_TEST_VIMEO_ID)).toThrow(/post id/);
  });

  it("blocks production hosts and allows kin-dev", () => {
    expect(isStudioCommentsPocProductionBlocked("knititnow.com")).toBe(true);
    expect(isStudioCommentsPocProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isStudioCommentsPocProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(isStudioCommentsPocProductionBlocked("localhost")).toBe(false);
  });

  it("is wired as a production 404 without changing Memberstack login", () => {
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    const page = readFileSync(resolve("src/pages/studio/comments-test.astro"), "utf8");
    expect(middleware).toContain("isStudioCommentsPocRoute");
    expect(middleware).toContain("isManagedStudioSessionRoute");
    expect(middleware).toContain("isStudioCommentsPocProductionBlocked");
    expect(page).toContain("status: 404");
    expect(page).toContain("Layout");
    expect(page).toContain("VimeoEmbed");
    expect(page).toContain("STUDIO_LOCAL_TEST_VIMEO_ID");
    expect(page.indexOf("VimeoEmbed")).toBeLessThan(page.indexOf("data-studio-comments-mount"));
    expect(page).toContain("Log in to comment");
    expect(page).toContain("Prefer to send me a private message?");
    expect(page.indexOf("data-studio-comments-login")).toBeLessThan(
      page.indexOf("data-studio-comments-mount"),
    );
    expect(page).not.toContain("<h1>");
    expect(page).toContain('width="120"');
    expect(page.indexOf("studio-comments-poc__logo")).toBeLessThan(page.indexOf("studio-comments-poc__lead"));
    expect(page).toContain("studioPrivateMessageHref");
    expect(page).toContain("STUDIO_LOCAL_TEST_POST_TITLE");
    expect(page).toContain("STUDIO_COMMENTS_POC_PAGE");
    expect(page).not.toContain("simpleSSO");
    expect(page).not.toContain("FASTCOMMENTS_API_SECRET");
  });
});

function request(token?: string): Request {
  return new Request("https://kin-dev.netlify.app/api/studio/fastcomments-sso", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const sandboxMember = {
  id: "mem_sb_ada",
  auth: { email: "ada@example.com", firstName: "Ignored" },
  customFields: { "first-name": "Ada", "last-name": "Lovelace" },
};

describe("studio SSO request", () => {
  it("returns a logged-out widget session with the stable discussion id", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request(),
      hostname: "kin-dev.netlify.app",
      apiSecret: SECRET,
      memberstack: null,
      readBearerToken: () => null,
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.urlId).toBe(STUDIO_FASTCOMMENTS_URL_ID);
    expect(body.urlId).not.toBe(STUDIO_COMMENTS_POC_PAGE);
    expect(body.urlId).not.toContain(STUDIO_LOCAL_TEST_VIMEO_ID);
    expect(body.authenticated).toBe(false);
    expect(body.sso).toBeNull();
    expect(JSON.stringify(body)).not.toContain("simpleSSO");
  });

  it("does not sign on a production host", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request("token"),
      hostname: "knititnow.com",
      apiSecret: SECRET,
      memberstack: {
        mode: "sandbox",
        verifyMemberToken: async () => ({ id: "mem_sb_ada" }),
        getMember: async () => sandboxMember,
      },
      readBearerToken: () => "token",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(SECRET);
  });

  it("refuses to verify with the live Memberstack secret", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request("token"),
      hostname: "kin-dev.netlify.app",
      apiSecret: SECRET,
      memberstack: {
        mode: "live",
        verifyMemberToken: async () => ({ id: "mem_sb_ada" }),
        getMember: async () => sandboxMember,
      },
      readBearerToken: () => "token",
    });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("memberstack-sandbox-secret-missing");
    expect(body.sso).toBeNull();
  });

  it("signs the verified member name and not an email username", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request("token"),
      hostname: "kin-dev.netlify.app",
      apiSecret: SECRET,
      now: 1700000000000,
      memberstack: {
        mode: "sandbox",
        verifyMemberToken: async () => ({ id: "mem_sb_ada" }),
        getMember: async () => sandboxMember,
      },
      readBearerToken: () => "token",
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.displayName).toBe("Ada L.");
    const decoded = JSON.parse(Buffer.from(body.sso.userDataJSONBase64, "base64").toString("utf8"));
    expect(decoded.username).toBe("Ada L.");
    expect(decoded.displayName).toBe("Ada L.");
    expect(JSON.stringify(decoded)).not.toContain("Lovelace");
    expect(decoded.email).toBe("ada@example.com");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(body).not.toHaveProperty("simpleSSO");
  });

  it("does not sign when the member has no name fields", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request("token"),
      hostname: "kin-dev.netlify.app",
      apiSecret: SECRET,
      memberstack: {
        mode: "sandbox",
        verifyMemberToken: async () => ({ id: "mem_sb_ada" }),
        getMember: async () => ({
          id: "mem_sb_ada",
          auth: { email: "ada@example.com" },
          customFields: {},
        }),
      },
      readBearerToken: () => "token",
    });
    const body = await response.json();
    expect(body.code).toBe("member-name-missing");
    expect(body.sso).toBeNull();
    expect(JSON.stringify(body)).not.toContain("ada@example.com");
  });

  it("does not fall back to simple SSO when the FastComments secret is missing", async () => {
    const response = await handleStudioFastcommentsSso({
      request: request("token"),
      hostname: "kin-dev.netlify.app",
      apiSecret: null,
      memberstack: {
        mode: "sandbox",
        verifyMemberToken: async () => ({ id: "mem_sb_ada" }),
        getMember: async () => sandboxMember,
      },
      readBearerToken: () => "token",
    });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("fastcomments-secret-missing");
    expect(body.displayName).toBe("Ada L.");
    expect(body.sso).toBeNull();
    expect(JSON.stringify(body)).not.toContain("simpleSSO");
  });
});

describe("widget config", () => {
  it("uses the proof discussion id and omits simple SSO", () => {
    const session: StudioCommentSession = {
      ok: true,
      tenantId: "HwyQ71u_sFy4",
      urlId: "ignored-path",
      authenticated: true,
      displayName: "Ada L.",
      sso: {
        userDataJSONBase64: "e30=",
        verificationHash: "abc",
        timestamp: 1,
      },
      code: null,
    };
    const config = studioFastcommentsBaseConfig(session);
    expect(config.urlId).toBe(STUDIO_FASTCOMMENTS_URL_ID);
    expect(studioWidgetDiscussionId(null)).toBe(STUDIO_FASTCOMMENTS_URL_ID);
    expect(studioWidgetDiscussionId("studio-post:1235389908")).toBe(STUDIO_FASTCOMMENTS_URL_ID);
    expect(studioWidgetDiscussionId("studio-post:11111111-1111-4111-8111-111111111111")).toBe(
      "studio-post:11111111-1111-4111-8111-111111111111",
    );
    expect(config).not.toHaveProperty("simpleSSO");
    expect(studioCommentStatusMessage(session)).toBe("Commenting as Ada L.");
    expect(studioCommentLoginVisible(session)).toBe(false);
    expect(
      studioCommentLoginVisible({ ...session, authenticated: false, displayName: null, sso: null }),
    ).toBe(true);
    expect(
      studioCommentStatusMessage({ ...session, sso: null, code: "member-name-missing" }),
    ).toBe("This account has no first name on file, so posting stays locked.");
  });
});
