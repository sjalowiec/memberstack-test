import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const listPatternErrataForAdmin = vi.hoisted(() => vi.fn());
const insertPatternErrata = vi.hoisted(() => vi.fn());
const getPatternErrataById = vi.hoisted(() => vi.fn());
const updatePatternErrata = vi.hoisted(() => vi.fn());
const listPublishedPatternErrata = vi.hoisted(() => vi.fn());
const scanPatternErrataImpact = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../../lib/patterns/errata/patternErrataStore", () => ({
  listPatternErrataForAdmin,
  insertPatternErrata,
  getPatternErrataById,
  updatePatternErrata,
  listPublishedPatternErrata,
}));

vi.mock("../../../../lib/patterns/errata/patternErrataImpact", () => ({
  scanPatternErrataImpact,
}));

vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    list: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

import { GET as adminList, POST } from "./index";
import { GET as adminGet, PATCH } from "./[id]";
import { GET as impactGet } from "./[id]/impact";
import { GET as publicList } from "../../pattern-errata";
import { BABY_KIDS_LENGTH_MATCH_RULES } from "../../../../lib/patterns/errata/babyKidsLengthErrata";

const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const draft = {
  id: "6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61",
  slug: "baby-kids-finished-length",
  status: "draft",
  title: "Baby and kids finished sweater lengths",
  whatChanged: "Lengths changed.",
  knitterAction: "Create a new pattern.",
  publishedOn: null,
  affectedBuilders: ["drop-shoulder", "sleeveless"],
  affectedSizes: { baby: ["3 mo"] },
  matchRules: BABY_KIDS_LENGTH_MATCH_RULES,
};

describe("pattern errata permissions", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    listPatternErrataForAdmin.mockReset();
    insertPatternErrata.mockReset();
    getPatternErrataById.mockReset();
    updatePatternErrata.mockReset();
    listPublishedPatternErrata.mockReset();
    scanPatternErrataImpact.mockReset();
  });

  it("rejects an admin list and a save when the caller is not an admin", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });

    const list = await adminList({
      request: jsonRequest("https://knititnow.test/api/admin/pattern-errata", "GET"),
      cookies,
    } as never);
    const save = await POST({
      request: jsonRequest("https://knititnow.test/api/admin/pattern-errata", "POST", { title: "Nope" }),
      cookies,
    } as never);

    expect(list.status).toBe(401);
    expect(save.status).toBe(401);
    expect(listPatternErrataForAdmin).not.toHaveBeenCalled();
    expect(insertPatternErrata).not.toHaveBeenCalled();
    const body = await list.json();
    expect(body.errata).toBeUndefined();
  });

  it("rejects impact lookup for a non-admin and does not scan saved patterns", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });

    const response = await impactGet({
      request: jsonRequest(
        "https://knititnow.test/api/admin/pattern-errata/6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61/impact",
        "GET",
      ),
      cookies,
      params: { id: draft.id },
    } as never);

    expect(response.status).toBe(403);
    expect(scanPatternErrataImpact).not.toHaveBeenCalled();
    expect(getPatternErrataById).not.toHaveBeenCalled();
  });

  it("rejects an edit when the caller is not an admin", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await PATCH({
      request: jsonRequest(`https://knititnow.test/api/admin/pattern-errata/${draft.id}`, "PATCH", {
        title: "Changed",
      }),
      cookies,
      params: { id: draft.id },
    } as never);
    expect(response.status).toBe(401);
    expect(updatePatternErrata).not.toHaveBeenCalled();
    expect(adminGet).toBeTypeOf("function");
  });

  it("returns published corrections on the public route and drops a draft", async () => {
    listPublishedPatternErrata.mockResolvedValue([
      draft,
      { ...draft, id: "published-id", status: "published", publishedOn: "2026-09-26" },
    ]);

    const response = await publicList({} as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.errata).toHaveLength(1);
    expect(body.errata[0].status).toBe("published");
    expect(body.errata[0].slug).toBe("baby-kids-finished-length");
    expect(JSON.stringify(body)).not.toContain('"status":"draft"');
  });
});
