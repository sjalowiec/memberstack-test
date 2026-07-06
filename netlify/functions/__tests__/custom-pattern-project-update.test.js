import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks/fixtures so the vi.mock factory can reference them safely.
const h = vi.hoisted(() => {
  const setMock = vi.fn(async () => {});
  const upsertMock = vi.fn(async () => {});
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
  return { setMock, upsertMock, existing };
});

// Keep the real guard/build helpers; only stub the blob IO + auth resolution.
vi.mock("../lib/custom-pattern-projects-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveProjectUserId: () => ({ userId: "u1", mode: "member" }),
    getProjectsStore: () => ({ set: h.setMock }),
    readProjectJson: async () => ({ ...h.existing, pattern: { ...h.existing.pattern } }),
    upsertProjectSummaryInIndex: h.upsertMock,
  };
});

import handler from "../custom-pattern-project-update.js";

const FREE_ENTITLEMENT = {
  patternSystem: "sleeveless",
  hasSystemAccess: false,
  freeClaimedForSystem: true,
};
const MEMBER_ENTITLEMENT = {
  patternSystem: "sleeveless",
  hasSystemAccess: true,
  freeClaimedForSystem: false,
};

function makeReq(data) {
  return { method: "PUT", json: async () => data };
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

describe("custom-pattern-project-update — metadataOnly rename gate", () => {
  beforeEach(() => {
    h.setMock.mockClear();
    h.upsertMock.mockClear();
  });

  it("blocks a free (claimed) user from renaming via a metadataOnly update", async () => {
    const res = await handler(
      makeReq(metadataBody({ name: "Brand new name", entitlement: FREE_ENTITLEMENT })),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/included with membership/i);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("allows a free user to update notes when the name is unchanged (metadataOnly)", async () => {
    const res = await handler(
      makeReq(
        metadataBody({ name: "Old name", notes: "Use cotton DK", entitlement: FREE_ENTITLEMENT }),
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(h.setMock).toHaveBeenCalledTimes(1);
  });

  it("allows a member to rename via a metadataOnly update", async () => {
    const res = await handler(
      makeReq(metadataBody({ name: "Brand new name", entitlement: MEMBER_ENTITLEMENT })),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.project.name).toBe("Brand new name");
    expect(h.setMock).toHaveBeenCalledTimes(1);
  });

  it("still blocks a free user's full (non-metadataOnly) settings edit", async () => {
    const res = await handler(
      makeReq({
        id: "proj-1",
        family: "sleeveless",
        name: "Old name",
        notes: "",
        source: "custom-build",
        pattern: { patternType: "sleeveless" },
        customOverrides: {},
        entitlement: FREE_ENTITLEMENT,
      }),
    );
    expect(res.status).toBe(403);
    expect(h.setMock).not.toHaveBeenCalled();
  });
});
