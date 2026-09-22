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
    expect(body.jumplinks[0]).toEqual({ time: 60, label: "Hang purl side to purl side" });
  });

  it("returns public catalog jump links without membership", async () => {
    const res = await handler(makeRequest("535"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(requireMember).not.toHaveBeenCalled();
    expect(body.jumplinks[0]).toEqual({ label: "Sample Neckline overview", time: 44 });
  });

  it("omits member catalog chapter labels when membership is denied", async () => {
    const res = await handler(
      makeRequest("520", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("Seaming on the machine");
  });

  it("returns catalog chapters after member access is confirmed", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const res = await handler(
      makeRequest("520", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jumplinks[0]).toEqual({ label: "Seaming on the machine", time: 13 });
  });

  it("omits I-Cord jump links when membership is denied", async () => {
    const res = await handler(
      makeRequest("266", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("Helecopter");
    expect(JSON.stringify(body)).not.toContain("Slip stitch on your machine");
  });

  it("returns I-Cord jump links only after member access is confirmed", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const res = await handler(
      makeRequest("266", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jumplinks).toEqual([
      { time: 36, label: "Slip stitch on your machine" },
      { time: 43, label: "Pick up and knit I-cord" },
      { time: 64, label: "Turn a corner" },
      { time: 80, label: "Loop Trim" },
      { time: 112, label: "Helecopter trim (give it a twist)" },
    ]);
  });

  it("returns catalog jumpLinks after member access is confirmed", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const res = await handler(
      makeRequest("2148", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jumplinks[0]).toEqual({ label: "Overview Steps", time: 15 });
  });

  it("does not attach jump links to videos that have none", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const memberNone = await handler(
      makeRequest("259", { headers: { Authorization: "Bearer good-token" } }),
    );
    expect(memberNone.status).toBe(200);
    const memberBody = await memberNone.json();
    expect(memberBody.ok).toBe(true);
    expect(memberBody).not.toHaveProperty("jumplinks");

    const publicNone = await handler(makeRequest("459"));
    expect(publicNone.status).toBe(200);
    const publicBody = await publicNone.json();
    expect(publicBody.ok).toBe(true);
    expect(publicBody).not.toHaveProperty("jumplinks");
  });
});
