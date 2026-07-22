import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks/fixtures so the vi.mock factory can reference them safely.
const h = vi.hoisted(() => {
  const setMock = vi.fn(async () => {});
  const upsertMock = vi.fn(async () => {});
  const accessMock = vi.fn(async () => ({ ok: true, userId: "u1", mode: "member" }));
  const existing = {
    id: "proj-1",
    name: "Old name",
    family: "sleeveless",
    source: "custom-build",
    pattern: { patternType: "sleeveless" },
    customOverrides: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  return { setMock, upsertMock, accessMock, existing };
});

vi.mock("../lib/require-member-access.js", () => ({
  requirePatternProjectAccess: (...args) => h.accessMock(...args),
}));

// Keep the real guard/build helpers; only stub the blob IO.
vi.mock("../lib/custom-pattern-projects-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProjectsStore: () => ({ set: h.setMock }),
    readProjectJson: async () => ({ ...h.existing, pattern: { ...h.existing.pattern } }),
    upsertProjectSummaryInIndex: h.upsertMock,
  };
});

import handler from "../custom-pattern-project-update.js";

const SPOOFED_ENTITLEMENT = {
  patternSystem: "sleeveless",
  hasSystemAccess: true,
  freeClaimedForSystem: false,
};

function makeReq(data) {
  return {
    method: "PUT",
    headers: new Headers({ Authorization: "Bearer good-token" }),
    json: async () => data,
  };
}

function metadataBody(overrides = {}) {
  return {
    id: "proj-1",
    family: "sleeveless",
    metadataOnly: true,
    name: "Old name",
    notes: "",
    source: "custom-build",
    pattern: { patternType: "sleeveless" },
    customOverrides: {},
    ...overrides,
  };
}

describe("custom-pattern-project-update — membership gate", () => {
  beforeEach(() => {
    h.setMock.mockClear();
    h.upsertMock.mockClear();
    h.accessMock.mockReset();
    h.accessMock.mockResolvedValue({ ok: true, userId: "u1", mode: "member" });
  });

  it("rejects non-members even when body.entitlement.hasSystemAccess is spoofed", async () => {
    h.accessMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "An active Knit it Now membership is required.",
    });
    const res = await handler(
      makeReq(metadataBody({ name: "Brand new name", entitlement: SPOOFED_ENTITLEMENT })),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/membership/i);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("allows an authenticated member to rename (client entitlement ignored)", async () => {
    const res = await handler(
      makeReq(
        metadataBody({
          name: "Brand new name",
          entitlement: { hasSystemAccess: false, freeClaimedForSystem: true },
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.project.name).toBe("Brand new name");
    expect(h.setMock).toHaveBeenCalledTimes(1);
  });

  it("allows an authenticated member to update notes", async () => {
    const res = await handler(
      makeReq(metadataBody({ name: "Old name", notes: "Use cotton DK" })),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(h.setMock).toHaveBeenCalledTimes(1);
  });

  it("allows an authenticated member full settings edit", async () => {
    const res = await handler(
      makeReq({
        id: "proj-1",
        family: "sleeveless",
        name: "Old name",
        notes: "",
        source: "custom-build",
        pattern: { patternType: "sleeveless" },
        customOverrides: {},
        entitlement: { hasSystemAccess: false },
      }),
    );
    expect(res.status).toBe(200);
    expect(h.setMock).toHaveBeenCalledTimes(1);
  });

  it("rejects anonymous / invalid auth before touching storage", async () => {
    h.accessMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const res = await handler(makeReq(metadataBody({ name: "Nope" })));
    expect(res.status).toBe(401);
    expect(h.setMock).not.toHaveBeenCalled();
  });
});
