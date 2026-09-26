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
import { createWatsonSessionToken, WATSON_SESSION_COOKIE } from "../../../../lib/watson/watsonAuth";

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

  it("returns the impact report for an authenticated admin and does not write patterns", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: "sue@knititnow.com" },
      mode: "verified",
    });
    getPatternErrataById.mockResolvedValue(draft);
    scanPatternErrataImpact.mockResolvedValue({
      readOnly: true,
      scanned: 4,
      potentiallyAffected: { patternCount: 2, ownerCount: 1, unknownOwnerCount: 0 },
      customized: { patternCount: 1, ownerCount: 1, unknownOwnerCount: 0 },
      currentDefault: { patternCount: 0, ownerCount: 0, unknownOwnerCount: 0 },
      uncertain: { patternCount: 1, ownerCount: 1, unknownOwnerCount: 0 },
      outOfScope: 0,
      rows: [],
    });

    const response = await impactGet({
      request: jsonRequest(
        "https://knititnow.com/api/admin/pattern-errata/6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61/impact",
        "GET",
      ),
      cookies,
      params: { id: draft.id },
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.report.scanned).toBe(4);
    expect(body.report.potentiallyAffected.patternCount).toBe(2);
    expect(body.report.readOnly).toBe(true);
    expect(scanPatternErrataImpact).toHaveBeenCalledTimes(1);
  });

  it("rejects a signed-out impact lookup and does not scan saved patterns", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });

    const response = await impactGet({
      request: jsonRequest(
        "https://knititnow.com/api/admin/pattern-errata/6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61/impact",
        "GET",
      ),
      cookies,
      params: { id: draft.id },
    } as never);

    expect(response.status).toBe(401);
    expect(scanPatternErrataImpact).not.toHaveBeenCalled();
    expect(getPatternErrataById).not.toHaveBeenCalled();
  });

  it("loads the impact report for Sue's Watson admin session when Memberstack is not the allowlisted id", async () => {
    const password = "watson-impact-test-password";
    (import.meta.env as Record<string, unknown>).WATSON_ADMIN_PASSWORD = password;
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    getPatternErrataById.mockResolvedValue(draft);
    scanPatternErrataImpact.mockResolvedValue({
      readOnly: true,
      scanned: 4,
      potentiallyAffected: { patternCount: 2, ownerCount: 1, unknownOwnerCount: 0 },
      customized: { patternCount: 1, ownerCount: 1, unknownOwnerCount: 0 },
      currentDefault: { patternCount: 0, ownerCount: 0, unknownOwnerCount: 0 },
      uncertain: { patternCount: 1, ownerCount: 1, unknownOwnerCount: 0 },
      outOfScope: 0,
      rows: [],
    });
    const token = createWatsonSessionToken(password);

    const response = await impactGet({
      request: jsonRequest(
        "https://knititnow.com/api/admin/pattern-errata/6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61/impact",
        "GET",
      ),
      cookies: {
        get: (name: string) => (name === WATSON_SESSION_COOKIE ? { value: token } : undefined),
      },
      params: { id: draft.id },
    } as never);

    Reflect.deleteProperty(import.meta.env as Record<string, unknown>, "WATSON_ADMIN_PASSWORD");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.report.scanned).toBe(4);
    expect(body.report.readOnly).toBe(true);
    expect(scanPatternErrataImpact).toHaveBeenCalledTimes(1);
  });

  it("does not treat a forged Watson cookie as admin", async () => {
    (import.meta.env as Record<string, unknown>).WATSON_ADMIN_PASSWORD = "watson-impact-test-password";
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });

    const response = await impactGet({
      request: jsonRequest(
        "https://knititnow.com/api/admin/pattern-errata/6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61/impact",
        "GET",
      ),
      cookies: {
        get: (name: string) =>
          name === WATSON_SESSION_COOKIE ? { value: "not-a-signed-session" } : undefined,
      },
      params: { id: draft.id },
    } as never);

    Reflect.deleteProperty(import.meta.env as Record<string, unknown>, "WATSON_ADMIN_PASSWORD");
    expect(response.status).toBe(403);
    expect(scanPatternErrataImpact).not.toHaveBeenCalled();
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
