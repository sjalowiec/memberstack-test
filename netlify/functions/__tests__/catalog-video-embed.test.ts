import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../lib/memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
}));

vi.mock("../../../src/lib/memberAccessServer", () => ({
  evaluateMemberAccessForRecord: vi.fn(),
}));

import handler from "../catalog-video-embed";
import { requireMember } from "../lib/member-auth.js";
import { getMemberstackAdminClient } from "../lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../../src/lib/memberAccessServer";

const VERIFIED_ID = "mem_from_jwt";

function makeRequest(contentId: string, init?: RequestInit) {
  return new Request(
    `https://example.com/.netlify/functions/catalog-video-embed?contentId=${encodeURIComponent(contentId)}`,
    { method: "GET", ...init },
  );
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: VERIFIED_ID, email: "jwt@example.com" },
    mode: "verified",
  });
  vi.mocked(getMemberstackAdminClient).mockReturnValue({
    getMember: vi.fn(async () => ({ id: VERIFIED_ID, planConnections: [] })),
  } as ReturnType<typeof getMemberstackAdminClient>);
  vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
    hasMemberAccess: false,
    viewerAccessState: "loggedInNoAccess",
    legacyPaidThroughYmd: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("catalog-video-embed", () => {
  it("returns a public video embed without requiring membership", async () => {
    const res = await handler(makeRequest("258"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.iframeSrc).toContain("player.vimeo.com/video/");
    expect(requireMember).not.toHaveBeenCalled();
  });

  it("does not return a member-only embed when access is denied", async () => {
    const res = await handler(
      makeRequest("257", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body).not.toHaveProperty("iframeSrc");
  });

  it("returns a member-only embed after hasMemberAccess is confirmed", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const res = await handler(
      makeRequest("257", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.iframeSrc).toContain("player.vimeo.com/video/");
  });
});
