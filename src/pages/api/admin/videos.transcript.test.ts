import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  catalog: vi.fn(),
  snapshot: vi.fn(),
  displayed: vi.fn(),
}));

vi.mock("../../../lib/admin/requireAdminRequest", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../lib/admin/requireAdminRequest")>(),
  requireAdminForRequest: mocks.auth,
}));
vi.mock("../../../lib/videos/videoCatalogStore", () => ({ loadMergedVideoCatalog: mocks.catalog }));
vi.mock("../../../lib/videos/videoCatalogRepo", () => ({
  videoCatalogRepoForHost: () => ({ readSnapshot: mocks.snapshot }),
}));
vi.mock("../../../lib/videos/videoTranscriptStore", () => ({ loadDisplayedTranscriptArtifact: mocks.displayed }));
vi.mock("../../../lib/videos/videoPosterStore", () => ({
  listVideoPosterOverrides: async () => new Map(),
  isMissingVideoPosterTable: () => false,
}));

import { GET } from "./videos";

const video = {
  content_id: 658,
  title: "Pinwheel Circles - Shortrow Fun",
  slug: "pinwheel-circles-shortrow-fun",
  vimeo_id: 151859578,
  status: "published",
  access_level: "member",
};

async function readAdmin() {
  return GET({
    request: new Request("https://knititnow.com/api/admin/videos"),
    cookies: { get: () => undefined },
  } as never);
}

describe("video admin transcript indicators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ ok: true, member: { id: "admin", email: "sue@example.com" } });
    mocks.catalog.mockResolvedValue([video]);
    mocks.snapshot.mockResolvedValue({ transcripts: { published: [], drafts: [] } });
    mocks.displayed.mockImplementation(async (_kind: string, bundled: unknown) => bundled);
  });

  it("recognizes video 658's deployed transcript even without an uploaded file listing", async () => {
    const response = await readAdmin();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.transcripts["658"]).toBe("published");
    expect(JSON.stringify(body)).not.toContain("You can knit in circles using short rows");
    expect(JSON.stringify(body)).not.toContain("WEBVTT");
  });

  it("still recognizes the deployed transcript when the file repository cannot be read", async () => {
    mocks.snapshot.mockRejectedValue(new Error("Repository unavailable"));
    expect((await (await readAdmin()).json()).transcripts["658"]).toBe("published");
  });

  it("recognizes stored generated text absent from the deployed transcript", async () => {
    mocks.catalog.mockResolvedValue([{ ...video, content_id: 9999, vimeo_id: 999999999 }]);
    mocks.displayed.mockImplementation(async (kind: string, bundled: unknown) => kind === "member" ? {
      generator: "catalog-transcripts",
      kind: "member",
      records: [{ vimeoId: "999999999", paragraphs: ["A stored transcript."] }],
    } : bundled);
    const body = await (await readAdmin()).json();
    expect(body.transcripts["9999"]).toBe("published");
    expect(JSON.stringify(body)).not.toContain("A stored transcript.");
  });

  it("keeps draft uploads marked as draft", async () => {
    mocks.catalog.mockResolvedValue([{ ...video, status: "draft" }]);
    mocks.snapshot.mockResolvedValue({ transcripts: { published: [], drafts: [{ name: "151859578.vtt", sha: "draft" }] } });
    expect((await (await readAdmin()).json()).transcripts["658"]).toBe("draft");
  });

  it("does not report a member transcript saved only for the wrong audience", async () => {
    mocks.displayed.mockImplementation(async (kind: string) => ({
      generator: "catalog-transcripts",
      kind,
      records: kind === "public" ? [{ vimeoId: "151859578", paragraphs: ["Wrong audience."] }] : [],
    }));
    expect((await (await readAdmin()).json()).transcripts["658"]).toBe("none");
  });

  it("rejects signed-out reads before checking transcript storage", async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await readAdmin();
    expect(response.status).toBe(401);
    expect(mocks.displayed).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
