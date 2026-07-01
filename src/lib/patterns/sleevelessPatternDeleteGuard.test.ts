import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import {
  isPatternDeleteProtectedForSystem,
  resolvePatternDeleteDecision,
  freePatternDeleteBlockedText,
} from "./sleevelessPatternDeleteGuard";
import { testAccess } from "./patternAccessTestFixtures";

const resolveAccessMock = vi.fn<[], Promise<SleevelessUserAccess>>();
const listProjectsMock = vi.fn();

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccessSnapshot: () => resolveAccessMock(),
}));
vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listProjectsMock(...args),
}));

const loggedOut = testAccess({ loggedIn: false, hasSystemAccess: false, freeClaimed: false });
const member = testAccess({
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
});
const freeUnclaimed = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: false,
});
const freeClaimedWithId = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_free",
});
const freeClaimedNoId = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
});

describe("isPatternDeleteProtectedForSystem", () => {
  it("never protects a logged-out visitor", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: loggedOut,
        projectId: "x",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });

  it("never protects a user with system access (member / owner)", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: member,
        projectId: "pat_1",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });

  it("does not protect a free user who has not claimed the allowance", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeUnclaimed,
        projectId: "anything",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });

  it("protects exactly the claimed pattern id for a free claimer", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedWithId,
        projectId: "pat_free",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 5,
      }),
    ).toBe(true);
  });

  it("does not protect other patterns when the claimed id is known", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedWithId,
        projectId: "pat_other",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 5,
      }),
    ).toBe(false);
  });

  it("fallback: protects the last remaining pattern when the claimed id is unknown", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedNoId,
        projectId: "only",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(true);
  });

  it("fallback: allows deleting when more than one pattern remains and id is unknown", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedNoId,
        projectId: "one-of-many",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 3,
      }),
    ).toBe(false);
  });
});

describe("resolvePatternDeleteDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the claimed pattern by id without fetching the saved list", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedWithId);

    const decision = await resolvePatternDeleteDecision("pat_free");

    expect(decision.blocked).toBe(true);
    expect(decision.message).toBe(freePatternDeleteBlockedText("sleeveless"));
    expect(decision.access).toBe(freeClaimedWithId);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("allows deleting a non-claimed pattern without fetching the saved list", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedWithId);

    const decision = await resolvePatternDeleteDecision("pat_other");

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("uses the supplied count for the unknown-id fallback (no list fetch)", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);

    const decision = await resolvePatternDeleteDecision("only", {
      totalSavedCountForSystem: 1,
    });

    expect(decision.blocked).toBe(true);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("fetches the saved list for the unknown-id fallback when no count is supplied", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);
    listProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        { id: "a", patternSystem: "sleeveless" },
        { id: "b", patternSystem: "sleeveless" },
      ],
    });

    const decision = await resolvePatternDeleteDecision("a");

    expect(listProjectsMock).toHaveBeenCalledWith("sleeveless");
    expect(decision.blocked).toBe(false);
  });

  it("defaults to protecting when the saved-list fetch fails", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);
    listProjectsMock.mockResolvedValue({ ok: false, error: "nope" });

    const decision = await resolvePatternDeleteDecision("a");

    expect(decision.blocked).toBe(true);
  });

  it("allows members to delete freely", async () => {
    resolveAccessMock.mockResolvedValue(member);

    const decision = await resolvePatternDeleteDecision("pat_1");

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });
});
