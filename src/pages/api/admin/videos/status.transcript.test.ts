import { beforeEach, describe, expect, it, vi } from "vitest";

import memberCatalogTranscripts from "../../../../data/transcripts/generated/member.json";
import videos from "../../../../data/videos-public.json";
import { CATALOG_TRANSCRIPT_GENERATOR } from "../../../../lib/transcripts/catalogTranscriptData";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadDisplayed = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../../lib/videos/videoTranscriptStore", () => ({
  loadDisplayedTranscriptArtifact: loadDisplayed,
}));

import { GET as videoStatus } from "./status";

const cookies = { get: () => undefined };

describe("video admin transcript status", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: "sue@example.com" },
      mode: "verified",
    });
    loadDisplayed.mockImplementation(async (_kind: string, bundled: unknown) => bundled);
  });

  it("reports video 658 live in the catalog and not live as a transcript", async () => {
    const response = await videoStatus({
      request: new Request("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
      cookies,
      url: new URL("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, contentId: "658", record: "live", live: true, transcriptLive: false });
    expect(JSON.stringify(body)).not.toContain("WEBVTT");
  });

  it("reports transcriptLive only when stored paragraphs are available to the right audience", async () => {
    const withTranscript = (videos as Array<{ content_id?: unknown; vimeo_id?: unknown; access_level?: unknown; status?: unknown }>).find(
      (video) => {
        const id = String(video.vimeo_id ?? "");
        return memberCatalogTranscripts.records.some((record) => record.vimeoId === id && record.paragraphs.length > 0);
      },
    );
    expect(withTranscript?.content_id).toBeTruthy();
    const response = await videoStatus({
      request: new Request(
        `https://kin-dev.netlify.app/api/admin/videos/status?content_id=${withTranscript!.content_id}`,
      ),
      cookies,
      url: new URL(
        `https://kin-dev.netlify.app/api/admin/videos/status?content_id=${withTranscript!.content_id}`,
      ),
    } as never);
    const body = await response.json();
    expect(body.transcriptLive).toBe(true);

    loadDisplayed.mockImplementation(async (kind: string, bundled: unknown) => {
      if (kind !== "member") return bundled;
      return {
        generator: CATALOG_TRANSCRIPT_GENERATOR,
        kind: "member",
        records: [
          {
            vimeoId: "151859578",
            sourceFile: "151859578.vtt",
            sourceSha256: "abc",
            paragraphs: ["Pinwheel short rows make the circle."],
          },
        ],
      };
    });
    const stored = await videoStatus({
      request: new Request("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
      cookies,
      url: new URL("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
    } as never);
    expect((await stored.json()).transcriptLive).toBe(true);

    loadDisplayed.mockImplementation(async (kind: string, bundled: unknown) => {
      if (kind !== "public") return bundled;
      return {
        generator: CATALOG_TRANSCRIPT_GENERATOR,
        kind: "public",
        records: [
          {
            vimeoId: "151859578",
            sourceFile: "151859578.vtt",
            sourceSha256: "abc",
            paragraphs: ["This public copy must not make a member video live."],
          },
        ],
      };
    });
    const wrongAudience = await videoStatus({
      request: new Request("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
      cookies,
      url: new URL("https://kin-dev.netlify.app/api/admin/videos/status?content_id=658"),
    } as never);
    expect((await wrongAudience.json()).transcriptLive).toBe(false);
  });
});
