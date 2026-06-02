import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import {
  isSleevelessPatternDeleteProtected,
  resolveSleevelessPatternDeleteDecision,
  SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT,
} from "./sleevelessPatternDeleteGuard";

const resolveAccessMock = vi.fn<[], Promise<SleevelessUserAccess>>();
const listProjectsMock = vi.fn();

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccessSnapshot: () => resolveAccessMock(),
}));
vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listProjectsMock(...args),
}));

const loggedOut: SleevelessUserAccess = {
  loggedIn: false,
  hasSystemAccess: false,
  freeClaimed: false,
};
const member: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
};
const freeUnclaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: false,
};
const freeClaimedWithId: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_free",
};
const freeClaimedNoId: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
};

describe("isSleevelessPatternDeleteProtected", () => {
  it("never protects a logged-out visitor", () => {
    expect(
      isSleevelessPatternDeleteProtected({ access: loggedOut, projectId: "x", totalSavedCount: 1 }),
    ).toBe(false);
  });

  it("never protects a user with system access (member / owner)", () => {
    expect(
      isSleevelessPatternDeleteProtected({ access: member, projectId: "pat_1", totalSavedCount: 1 }),
    ).toBe(false);
  });

  it("does not protect a free user who has not claimed the allowance", () => {
    expect(
      isSleevelessPatternDeleteProtected({
        access: freeUnclaimed,
        projectId: "anything",
        totalSavedCount: 1,
      }),
    ).toBe(false);
  });

  it("protects exactly the claimed pattern id for a free claimer", () => {
    expect(
      isSleevelessPatternDeleteProtected({
        access: freeClaimedWithId,
        projectId: "pat_free",
        totalSavedCount: 5,
      }),
    ).toBe(true);
  });

  it("does not protect other patterns when the claimed id is known", () => {
    expect(
      isSleevelessPatternDeleteProtected({
        access: freeClaimedWithId,
        projectId: "pat_other",
        totalSavedCount: 5,
      }),
    ).toBe(false);
  });

  it("fallback: protects the last remaining pattern when the claimed id is unknown", () => {
    expect(
      isSleevelessPatternDeleteProtected({
        access: freeClaimedNoId,
        projectId: "only",
        totalSavedCount: 1,
      }),
    ).toBe(true);
  });

  it("fallback: allows deleting when more than one pattern remains and id is unknown", () => {
    expect(
      isSleevelessPatternDeleteProtected({
        access: freeClaimedNoId,
        projectId: "one-of-many",
        totalSavedCount: 3,
      }),
    ).toBe(false);
  });
});

describe("resolveSleevelessPatternDeleteDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the claimed pattern by id without fetching the saved list", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedWithId);

    const decision = await resolveSleevelessPatternDeleteDecision("pat_free");

    expect(decision.blocked).toBe(true);
    expect(decision.message).toBe(SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT);
    expect(decision.access).toBe(freeClaimedWithId);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("allows deleting a non-claimed pattern without fetching the saved list", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedWithId);

    const decision = await resolveSleevelessPatternDeleteDecision("pat_other");

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("uses the supplied count for the unknown-id fallback (no list fetch)", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);

    const decision = await resolveSleevelessPatternDeleteDecision("only", { totalSavedCount: 1 });

    expect(decision.blocked).toBe(true);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("fetches the saved list for the unknown-id fallback when no count is supplied", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);
    listProjectsMock.mockResolvedValue({ ok: true, projects: [{ id: "a" }, { id: "b" }] });

    const decision = await resolveSleevelessPatternDeleteDecision("a");

    expect(listProjectsMock).toHaveBeenCalledWith("sleeveless");
    expect(decision.blocked).toBe(false);
  });

  it("defaults to protecting when the saved-list fetch fails", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);
    listProjectsMock.mockResolvedValue({ ok: false, error: "nope" });

    const decision = await resolveSleevelessPatternDeleteDecision("a");

    expect(decision.blocked).toBe(true);
  });

  it("allows members to delete freely", async () => {
    resolveAccessMock.mockResolvedValue(member);

    const decision = await resolveSleevelessPatternDeleteDecision("pat_1");

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });
});
