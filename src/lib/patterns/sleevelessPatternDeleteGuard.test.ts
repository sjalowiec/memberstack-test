import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import {
  isPatternDeleteProtectedForSystem,
  resolvePatternDeleteDecision,
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
const member = testAccess({
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
});

describe("isPatternDeleteProtectedForSystem", () => {
  it("never protects a claimed free pattern without system access", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedWithId,
        projectId: "pat_free",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });

  it("never protects the last remaining pattern when the claimed id is unknown", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: freeClaimedNoId,
        projectId: "only",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });

  it("never protects a member pattern either", () => {
    expect(
      isPatternDeleteProtectedForSystem({
        access: member,
        projectId: "pat_1",
        patternSystem: "sleeveless",
        totalSavedCountForSystem: 1,
      }),
    ).toBe(false);
  });
});

describe("resolvePatternDeleteDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows deleting a claimed free pattern without system access", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedWithId);

    const decision = await resolvePatternDeleteDecision("pat_free");

    expect(decision.blocked).toBe(false);
    expect(decision.message).toBeNull();
    expect(decision.access).toBe(freeClaimedWithId);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("allows deleting when only one free-claimed pattern remains", async () => {
    resolveAccessMock.mockResolvedValue(freeClaimedNoId);

    const decision = await resolvePatternDeleteDecision("only", {
      totalSavedCountForSystem: 1,
    });

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("allows members to delete freely", async () => {
    resolveAccessMock.mockResolvedValue(member);

    const decision = await resolvePatternDeleteDecision("pat_1");

    expect(decision.blocked).toBe(false);
    expect(listProjectsMock).not.toHaveBeenCalled();
  });
});
