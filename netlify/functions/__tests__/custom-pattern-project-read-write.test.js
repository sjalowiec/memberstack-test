import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const identityMock = vi.fn();
  const accessMock = vi.fn();
  const listMock = vi.fn();
  const readMock = vi.fn();
  const setMock = vi.fn(async () => {});
  const getMetadataMock = vi.fn();
  const deleteIndexMock = vi.fn(async () => []);
  const upsertMock = vi.fn(async () => {});
  const ownerProject = {
    id: "proj-own",
    name: "My Socks",
    family: "sleeveless",
    source: "express",
    pattern: { patternType: "socks", patternSystem: "socks" },
    customOverrides: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
  };
  return {
    identityMock,
    accessMock,
    listMock,
    readMock,
    setMock,
    getMetadataMock,
    deleteIndexMock,
    upsertMock,
    ownerProject,
  };
});

vi.mock("../lib/require-member-access.js", () => ({
  requirePatternProjectIdentity: (...args) => h.identityMock(...args),
  requirePatternProjectAccess: (...args) => h.accessMock(...args),
}));

vi.mock("../lib/custom-pattern-projects-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProjectsStore: () => ({
      set: h.setMock,
      getMetadata: h.getMetadataMock,
    }),
    listProjectSummaries: (...args) => h.listMock(...args),
    readProjectJson: (...args) => h.readMock(...args),
    deleteProjectAndUpdateIndex: h.deleteIndexMock,
    upsertProjectSummaryInIndex: h.upsertMock,
  };
});

import listHandler from "../custom-pattern-project-list.js";
import loadHandler from "../custom-pattern-project-load.js";
import saveHandler from "../custom-pattern-project-save.js";
import updateHandler from "../custom-pattern-project-update.js";
import deleteHandler from "../custom-pattern-project-delete.js";

const FORMER = { ok: true, userId: "mem_former", mode: "member" };
const ACTIVE = { ok: true, userId: "mem_active", mode: "member" };
const ANON = { ok: false, status: 401, error: "Sign in required." };
const NO_MEMBERSHIP = {
  ok: false,
  status: 403,
  error: "An active Knit it Now membership is required.",
};

function getReq(url = "https://example.com/.netlify/functions/custom-pattern-project-list") {
  return new Request(url, {
    method: "GET",
    headers: { Authorization: "Bearer token" },
  });
}

function jsonReq(method, url, data) {
  return {
    method,
    headers: new Headers({ Authorization: "Bearer token" }),
    json: async () => data,
    url,
  };
}

const SAVE_BODY = {
  name: "Copy of socks",
  family: "sleeveless",
  source: "express",
  pattern: { patternType: "socks", patternSystem: "socks" },
  customOverrides: {},
  entitlement: { hasSystemAccess: true },
};

describe("saved-pattern read/write authorization", () => {
  beforeEach(() => {
    h.identityMock.mockReset();
    h.accessMock.mockReset();
    h.listMock.mockReset();
    h.readMock.mockReset();
    h.setMock.mockClear();
    h.getMetadataMock.mockReset();
    h.deleteIndexMock.mockClear();
    h.upsertMock.mockClear();
  });

  it("logged-out list/load/delete return 401", async () => {
    h.identityMock.mockResolvedValue(ANON);
    expect((await listHandler(getReq())).status).toBe(401);
    expect(
      (await loadHandler(getReq("https://example.com/.netlify/functions/custom-pattern-project-load?id=proj-own")))
        .status,
    ).toBe(401);
    expect(
      (await deleteHandler(jsonReq("DELETE", "https://example.com/delete", { id: "proj-own" }))).status,
    ).toBe(401);
  });

  it("former member can list only their owner-scoped summaries", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.listMock.mockResolvedValue([
      { id: "proj-own", name: "My Socks", patternSystem: "socks" },
    ]);
    const res = await listHandler(getReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.projects).toEqual([{ id: "proj-own", name: "My Socks", patternSystem: "socks" }]);
    expect(h.listMock).toHaveBeenCalledWith(expect.anything(), "sleeveless", "mem_former");
    expect(h.accessMock).not.toHaveBeenCalled();
  });

  it("former member can load their own pattern", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.readMock.mockResolvedValue(h.ownerProject);
    const res = await loadHandler(
      getReq("https://example.com/.netlify/functions/custom-pattern-project-load?id=proj-own"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.project.id).toBe("proj-own");
    expect(h.accessMock).not.toHaveBeenCalled();
  });

  it("former member loading another member's id receives 404", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.readMock.mockResolvedValue(null);
    const res = await loadHandler(
      getReq("https://example.com/.netlify/functions/custom-pattern-project-load?id=proj-other"),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/not found/i);
  });

  it("former member cannot save/create even with spoofed entitlement", async () => {
    h.accessMock.mockResolvedValue(NO_MEMBERSHIP);
    const res = await saveHandler(jsonReq("POST", "https://example.com/save", SAVE_BODY));
    expect(res.status).toBe(403);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("former member cannot update full pattern data, metadata-only, or workflow-only", async () => {
    h.accessMock.mockResolvedValue(NO_MEMBERSHIP);
    const full = await updateHandler(
      jsonReq("PUT", "https://example.com/update", {
        id: "proj-own",
        ...SAVE_BODY,
      }),
    );
    const meta = await updateHandler(
      jsonReq("PUT", "https://example.com/update", {
        id: "proj-own",
        metadataOnly: true,
        name: "Renamed",
        ...SAVE_BODY,
      }),
    );
    const workflow = await updateHandler(
      jsonReq("PUT", "https://example.com/update", {
        id: "proj-own",
        workflowOnly: true,
        readingWorkflow: { tips: { showAll: false, dismissedTipIds: [] } },
      }),
    );
    expect(full.status).toBe(403);
    expect(meta.status).toBe(403);
    expect(workflow.status).toBe(403);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("former member can delete their own pattern", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.getMetadataMock.mockResolvedValue({ metadata: { userId: "mem_former" } });
    const res = await deleteHandler(
      jsonReq("DELETE", "https://example.com/delete", { id: "proj-own", family: "sleeveless" }),
    );
    expect(res.status).toBe(200);
    expect(h.deleteIndexMock).toHaveBeenCalledWith(
      expect.anything(),
      "sleeveless",
      "mem_former",
      "proj-own",
    );
    expect(h.accessMock).not.toHaveBeenCalled();
  });

  it("former member cannot delete another member's pattern", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.getMetadataMock.mockResolvedValue(null);
    const res = await deleteHandler(
      jsonReq("DELETE", "https://example.com/delete", { id: "proj-other" }),
    );
    expect(res.status).toBe(404);
    expect(h.deleteIndexMock).not.toHaveBeenCalled();
  });

  it("active members retain create/update", async () => {
    h.accessMock.mockResolvedValue(ACTIVE);
    const saveRes = await saveHandler(jsonReq("POST", "https://example.com/save", SAVE_BODY));
    expect(saveRes.status).toBe(200);
    expect(h.setMock).toHaveBeenCalled();
  });

  it("copy/duplication is blocked because it uses save/create", async () => {
    h.accessMock.mockResolvedValue(NO_MEMBERSHIP);
    const res = await saveHandler(
      jsonReq("POST", "https://example.com/save", {
        ...SAVE_BODY,
        name: "Copy of socks",
      }),
    );
    expect(res.status).toBe(403);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("client-supplied member ids cannot override JWT ownership on load", async () => {
    h.identityMock.mockResolvedValue(FORMER);
    h.readMock.mockResolvedValue(null);
    const res = await loadHandler(
      getReq(
        "https://example.com/.netlify/functions/custom-pattern-project-load?id=proj-other&memberId=mem_other",
      ),
    );
    expect(res.status).toBe(404);
    expect(h.readMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("mem_former"),
    );
    expect(String(h.readMock.mock.calls[0]?.[1] ?? "")).not.toContain("mem_other");
  });

  it("Watson paid-through members keep mutation access through requirePatternProjectAccess", async () => {
    h.accessMock.mockResolvedValue({ ok: true, userId: "mem_watson", mode: "member" });
    const saveRes = await saveHandler(jsonReq("POST", "https://example.com/save", SAVE_BODY));
    expect(saveRes.status).toBe(200);
    expect(h.identityMock).not.toHaveBeenCalled();
    expect(h.accessMock).toHaveBeenCalled();
  });
});
