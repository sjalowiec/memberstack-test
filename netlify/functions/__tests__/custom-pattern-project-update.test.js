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
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  return { setMock, upsertMock, accessMock, existing, missing: false };
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
    readProjectJson: async () =>
      h.missing
        ? null
        : {
            ...h.existing,
            pattern: { ...h.existing.pattern },
            customOverrides: { ...(h.existing.customOverrides ?? {}) },
          },
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
    h.missing = false;
    h.existing.id = "proj-1";
    h.existing.name = "Old name";
    h.existing.family = "sleeveless";
    h.existing.source = "custom-build";
    h.existing.pattern = { patternType: "sleeveless" };
    h.existing.customOverrides = {};
    h.existing.createdAt = "2026-01-01T00:00:00.000Z";
    h.existing.updatedAt = "2026-01-01T00:00:00.000Z";
    h.existing.version = 1;
    delete h.existing.notes;
    delete h.existing.memberNotes;
    delete h.existing.readingWorkflow;
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

function storedProject() {
  const raw = h.setMock.mock.calls.at(-1)?.[1];
  return JSON.parse(raw);
}

describe("custom-pattern-project-update — My Notes", () => {
  beforeEach(() => {
    h.setMock.mockClear();
    h.upsertMock.mockClear();
    h.accessMock.mockReset();
    h.accessMock.mockResolvedValue({ ok: true, userId: "u1", mode: "member" });
    h.missing = false;
    h.existing.id = "proj-1";
    h.existing.family = "sleeveless";
    h.existing.source = "custom-build";
    h.existing.createdAt = "2026-01-01T00:00:00.000Z";
    h.existing.updatedAt = "2026-01-01T00:00:00.000Z";
    h.existing.notes = "Print me";
    h.existing.memberNotes = "Keep me";
    h.existing.pattern = { patternType: "sleeveless", measurements: { bust: 36 } };
    h.existing.customOverrides = { needle: 200 };
    h.existing.readingWorkflow = { sections: { back: true } };
    h.existing.version = 4;
    h.existing.name = "Sue's vest";
  });

  it("saves notes for that project without changing the pattern or print notes", async () => {
    const res = await handler(
      makeReq({
        id: "proj-1",
        memberNotesOnly: true,
        memberNotes: "  Use the blue yarn.\r\nRow counter on the left.  ",
        name: "Hijacked",
        notes: "Should not print",
        pattern: { patternType: "sleeveless", corrupted: true },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.project.memberNotes).toBe("Use the blue yarn.\nRow counter on the left.");
    const stored = storedProject();
    expect(stored.memberNotes).toBe("Use the blue yarn.\nRow counter on the left.");
    expect(stored.name).toBe("Sue's vest");
    expect(stored.notes).toBe("Print me");
    expect(stored.pattern).toEqual({ patternType: "sleeveless", measurements: { bust: 36 } });
    expect(stored.customOverrides).toEqual({ needle: 200 });
    expect(stored.readingWorkflow).toEqual({ sections: { back: true } });
    expect(stored.version).toBe(4);
    expect(stored.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stored.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("clears notes and still keeps the rest of the saved pattern", async () => {
    const res = await handler(
      makeReq({
        id: "proj-1",
        memberNotesOnly: true,
        memberNotes: "   \n",
      }),
    );
    expect(res.status).toBe(200);
    const stored = storedProject();
    expect(stored.memberNotes).toBeUndefined();
    expect(stored.name).toBe("Sue's vest");
    expect(stored.notes).toBe("Print me");
    expect(stored.pattern.measurements).toEqual({ bust: 36 });
    expect(stored.version).toBe(4);
  });

  it("keeps notes when the pattern is edited or regenerated", async () => {
    const res = await handler(
      makeReq({
        id: "proj-1",
        family: "sleeveless",
        name: "Sue's vest",
        notes: "Updated print note",
        memberNotes: "",
        source: "custom-build",
        pattern: { patternType: "sleeveless", measurements: { bust: 42 } },
        customOverrides: { needle: 220 },
      }),
    );
    expect(res.status).toBe(200);
    const stored = storedProject();
    expect(stored.memberNotes).toBe("Keep me");
    expect(stored.notes).toBe("Updated print note");
    expect(stored.pattern.measurements).toEqual({ bust: 42 });
    expect(stored.customOverrides).toEqual({ needle: 220 });
    expect(stored.readingWorkflow).toEqual({ sections: { back: true } });
    expect(stored.version).toBe(5);
  });

  it("leaves an older pattern without notes empty instead of inventing any", async () => {
    delete h.existing.memberNotes;
    const res = await handler(
      makeReq({
        id: "proj-1",
        family: "sleeveless",
        name: "Sue's vest",
        notes: "Print me",
        source: "custom-build",
        pattern: { patternType: "sleeveless", measurements: { bust: 36 } },
        customOverrides: { needle: 200 },
        memberNotes: "should not be written on a full save",
      }),
    );
    expect(res.status).toBe(200);
    const stored = storedProject();
    expect(stored.memberNotes).toBeUndefined();
    expect(stored.notes).toBe("Print me");
  });

  it("rejects notes that are not plain text or are too long without writing", async () => {
    const notText = await handler(
      makeReq({ id: "proj-1", memberNotesOnly: true, memberNotes: { text: "nope" } }),
    );
    expect(notText.status).toBe(400);
    expect(h.setMock).not.toHaveBeenCalled();

    const tooLong = await handler(
      makeReq({ id: "proj-1", memberNotesOnly: true, memberNotes: "a".repeat(8001) }),
    );
    expect(tooLong.status).toBe(400);
    const json = await tooLong.json();
    expect(json.error).toMatch(/8000/);
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it("uses the same membership and ownership checks as other project updates", async () => {
    h.accessMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "An active Knit it Now membership is required.",
    });
    const denied = await handler(
      makeReq({ id: "proj-1", memberNotesOnly: true, memberNotes: "Mine" }),
    );
    expect(denied.status).toBe(403);
    expect(h.setMock).not.toHaveBeenCalled();

    h.accessMock.mockResolvedValue({ ok: true, userId: "u1", mode: "member" });
    h.missing = true;
    const missing = await handler(
      makeReq({ id: "someone-elses", memberNotesOnly: true, memberNotes: "Mine" }),
    );
    expect(missing.status).toBe(404);
    expect(h.setMock).not.toHaveBeenCalled();
  });
});
