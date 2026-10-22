import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  helpHubPreviewAuthRequest,
  isLocalDevHelpHubPreviewBypass,
} from "./localDevPreviewAuth";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_JWT = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJtZW1fdGVzdCJ9.signature";

function previewRequest(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FAKE_JWT}`,
      "X-Kin-Member-Token": FAKE_JWT,
      Cookie: `_ms_cookie=${FAKE_JWT}; kin_session=keep-me`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document: { title: "Question", slug: "question" } }),
  });
}

describe("local Help Hub preview auth", () => {
  it("ignores a Memberstack session on localhost dev when the existing dev flag is on", () => {
    const request = previewRequest("http://127.0.0.1:4321/help-hub/preview?allowDev=1");
    expect(
      isLocalDevHelpHubPreviewBypass(request, { isViteDev: true, allowDevPatternUser: true }),
    ).toBe(true);
    const auth = helpHubPreviewAuthRequest(request, {
      isViteDev: true,
      allowDevPatternUser: true,
    });
    expect(auth.ignoreCookieStore).toBe(true);
    expect(auth.request.headers.get("authorization")).toBeNull();
    expect(auth.request.headers.get("x-kin-member-token")).toBeNull();
    expect(auth.request.headers.get("cookie")).toBe("kin_session=keep-me");
    expect(auth.request.url).toContain("allowDev=1");
  });

  it("keeps the Memberstack session on a hosted site even if the dev flag is on", () => {
    const request = previewRequest("https://kin-dev.knititnow.com/help-hub/preview?allowDev=1");
    expect(
      isLocalDevHelpHubPreviewBypass(request, { isViteDev: false, allowDevPatternUser: true }),
    ).toBe(false);
    const auth = helpHubPreviewAuthRequest(request, {
      isViteDev: false,
      allowDevPatternUser: true,
    });
    expect(auth.ignoreCookieStore).toBe(false);
    expect(auth.request.headers.get("authorization")).toBe(`Bearer ${FAKE_JWT}`);
    expect(auth.request).toBe(request);
  });

  it("does not bypass localhost when the dev server flag is off", () => {
    const request = previewRequest("http://localhost:4321/help-hub/preview");
    expect(
      isLocalDevHelpHubPreviewBypass(request, { isViteDev: true, allowDevPatternUser: false }),
    ).toBe(false);
  });

  it("does not bypass a non-local host during vite dev", () => {
    const request = previewRequest("http://192.168.1.20:4321/help-hub/preview");
    expect(
      isLocalDevHelpHubPreviewBypass(request, { isViteDev: true, allowDevPatternUser: true }),
    ).toBe(false);
  });

  it("uses the bypass only for preview and leaves Help Hub writes on requireAdmin", () => {
    const previewSource = readFileSync(join(here, "../../pages/help-hub/preview.astro"), "utf8");
    const saveSource = readFileSync(join(here, "../../pages/api/admin/help-hub/index.ts"), "utf8");
    const saveItemSource = readFileSync(join(here, "../../pages/api/admin/help-hub/[id].ts"), "utf8");
    expect(previewSource).toContain("helpHubPreviewAuthRequest");
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).not.toContain("searchParams");
    expect(saveSource).not.toContain("helpHubPreviewAuthRequest");
    expect(saveSource).toContain("requireAdminForRequest");
    expect(saveItemSource).not.toContain("helpHubPreviewAuthRequest");
    expect(saveItemSource).toContain("requireAdminForRequest");
  });
});
