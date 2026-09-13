import { describe, expect, it } from "vitest";
import { hasMemberAccess, getViewerAccessState } from "./memberAccess";
import {
  localMemberPreviewBypassIsOn,
  resolveSharedMemberAccessSnapshot,
} from "./localMemberPreviewBypass";

describe("localMemberPreviewBypassIsOn", () => {
  it("requires a localhost-style host and an explicit opt-in", () => {
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "localhost",
        search: "?member=true",
      }),
    ).toBe(true);
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "127.0.0.1",
        search: "?member=true",
      }),
    ).toBe(true);
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "::1",
        search: "?member=true",
      }),
    ).toBe(true);
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "studio.local",
        search: "?foo=1&member=true",
      }),
    ).toBe(true);
  });

  it("honors the BaseLayout body class / window flag on localhost", () => {
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "localhost",
        search: "",
        bodyHasDevMember: true,
      }),
    ).toBe(true);
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "localhost",
        search: "",
        kbmDevMember: true,
      }),
    ).toBe(true);
  });

  it("stays off without the query param on localhost", () => {
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "localhost",
        search: "",
      }),
    ).toBe(false);
    expect(
      localMemberPreviewBypassIsOn({
        hostname: "localhost",
        search: "?member=1",
      }),
    ).toBe(false);
  });

  it("never fires on production, Netlify previews, or unknown hosts", () => {
    for (const hostname of [
      "knititnow.com",
      "www.knititnow.com",
      "kin-dev.netlify.app",
      "deploy-preview-12--knititnow.netlify.app",
      "staging.example.com",
    ]) {
      expect(
        localMemberPreviewBypassIsOn({
          hostname,
          search: "?member=true",
          bodyHasDevMember: true,
          kbmDevMember: true,
        }),
      ).toBe(false);
    }
  });
});

describe("resolveSharedMemberAccessSnapshot", () => {
  it("lets real Memberstack access win over the bypass", () => {
    expect(
      resolveSharedMemberAccessSnapshot({
        memberHasAccess: true,
        viewerAccessState: "memberAccess",
        bypassOn: true,
      }),
    ).toEqual({ hasMemberAccess: true, viewerAccessState: "memberAccess" });
  });

  it("grants the shared snapshot only when Memberstack did not", () => {
    expect(
      resolveSharedMemberAccessSnapshot({
        memberHasAccess: false,
        viewerAccessState: "loggedOut",
        bypassOn: true,
      }),
    ).toEqual({ hasMemberAccess: true, viewerAccessState: "memberAccess" });
    expect(
      resolveSharedMemberAccessSnapshot({
        memberHasAccess: false,
        viewerAccessState: "loggedInNoAccess",
        bypassOn: true,
      }),
    ).toEqual({ hasMemberAccess: true, viewerAccessState: "memberAccess" });
  });

  it("leaves logged-out localhost unchanged when the opt-in is off", () => {
    expect(
      resolveSharedMemberAccessSnapshot({
        memberHasAccess: false,
        viewerAccessState: "loggedOut",
        bypassOn: false,
      }),
    ).toEqual({ hasMemberAccess: false, viewerAccessState: "loggedOut" });
  });
});

describe("hasMemberAccess stays independent of the localhost preview", () => {
  it("does not grant access from a null payload", () => {
    expect(hasMemberAccess(null)).toBe(false);
    expect(getViewerAccessState(null)).toBe("loggedOut");
  });
});

describe("BaseLayout wires the preview into the shared snapshot only", () => {
  it("uses the helper and does not put a bypass inside memberAccess.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const layout = readFileSync(join(here, "../layouts/BaseLayout.astro"), "utf8");
    const memberAccess = readFileSync(join(here, "memberAccess.ts"), "utf8");
    expect(layout).toContain("localMemberPreviewBypassIsOn");
    expect(layout).toContain("resolveSharedMemberAccessSnapshot");
    expect(layout).toContain("isLocalhostHost");
    expect(memberAccess).not.toContain("localMemberPreviewBypass");
    expect(memberAccess).not.toContain("dev-member");
  });
});
