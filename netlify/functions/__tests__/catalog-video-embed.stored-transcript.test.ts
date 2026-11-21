import { beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOG_TRANSCRIPT_GENERATOR } from "../../../src/lib/transcripts/catalogTranscriptData";

const featuredTipVideoContentId = vi.hoisted(() => vi.fn(async () => null as string | null));
const loadDisplayed = vi.hoisted(() => vi.fn());

vi.mock("../../../src/lib/videos/featuredTipPlayback", async () => {
  const actual = await vi.importActual<typeof import("../../../src/lib/videos/featuredTipPlayback")>(
    "../../../src/lib/videos/featuredTipPlayback",
  );
  return { ...actual, loadCurrentFeaturedTipVideoContentId: featuredTipVideoContentId };
});

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../lib/memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
}));

vi.mock("../../../src/lib/memberAccessServer", () => ({
  evaluateMemberAccessForRecord: vi.fn(),
}));

vi.mock("../../../src/lib/videos/videoTranscriptStore", () => ({
  loadDisplayedTranscriptArtifact: loadDisplayed,
}));

import handler from "../catalog-video-embed";
import { requireMember } from "../lib/member-auth.js";
import { getMemberstackAdminClient } from "../lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../../src/lib/memberAccessServer";

const sentence = "Pinwheel short rows make the circle.";

function makeRequest(contentId: string, init?: RequestInit) {
  return new Request(
    `https://example.com/.netlify/functions/catalog-video-embed?contentId=${encodeURIComponent(contentId)}`,
    { method: "GET", ...init },
  );
}

describe("stored member transcripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuredTipVideoContentId.mockResolvedValue(null);
    loadDisplayed.mockImplementation(async (kind: string, bundled: { records?: unknown[] }) => {
      if (kind !== "member") return bundled;
      return {
        generator: CATALOG_TRANSCRIPT_GENERATOR,
        kind: "member",
        records: [
          ...(bundled.records ?? []),
          {
            vimeoId: "151859578",
            sourceFile: "151859578.vtt",
            sourceSha256: "abc",
            paragraphs: [sentence],
          },
        ],
      };
    });
    vi.mocked(requireMember).mockResolvedValue({
      ok: true,
      member: { id: "mem_from_jwt", email: "member@example.com" },
      mode: "verified",
    });
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      getMember: vi.fn(async () => ({ id: "mem_from_jwt", planConnections: [] })),
    } as ReturnType<typeof getMemberstackAdminClient>);
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: false,
      viewerAccessState: "loggedInNoAccess",
      legacyPaidThroughYmd: null,
    });
  });

  it("does not return the stored transcript until membership is confirmed", async () => {
    const denied = await handler(makeRequest("658", { headers: { Authorization: "Bearer good-token" } }));
    expect(denied.status).toBe(403);
    expect(JSON.stringify(await denied.json())).not.toContain(sentence);

    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const allowed = await handler(makeRequest("658", { headers: { Authorization: "Bearer good-token" } }));
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.transcript.join(" ")).toContain(sentence);
    expect(JSON.stringify(body.transcript)).not.toContain("WEBVTT");
  });

  it("does not put a stored member transcript on an open video", async () => {
    const res = await handler(makeRequest("2189"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("transcript");
    expect(JSON.stringify(body)).not.toContain(sentence);
    expect(requireMember).not.toHaveBeenCalled();
  });
});
