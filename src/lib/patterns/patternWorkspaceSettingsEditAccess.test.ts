import { beforeEach, describe, expect, it, vi } from "vitest";
import { testAccess } from "./patternAccessTestFixtures";
import {
  blockPatternWorkspaceSettingsEditOrOfferUnlock,
  isPatternWorkspaceSettingsEditingLocked,
  resolvePatternWorkspaceSettingsEditGate,
} from "./patternWorkspaceSettingsEditAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import {
  CONSTRUCTION_AUTHORED_KEY,
  DROP_SHOULDER_CONSTRUCTION,
} from "./patternConstructionIdentity";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { writeHydratedConstructionBaseline } from "./customPatternProjectConstructionBaseline";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { stubLocalStorage, stubSessionStorage } from "./test/stubLocalStorage";

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: vi.fn(),
}));

vi.mock("./patternEditingUnlockModal", () => ({
  offerPatternEditingUnlockModal: vi.fn(),
}));

describe("isPatternWorkspaceSettingsEditingLocked", () => {
  it("locks nosub with claimed drop-shoulder when system is drop-shoulder", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
      freeClaimedPatternId: "proj-drop",
    });
    expect(isPatternWorkspaceSettingsEditingLocked(access, "drop-shoulder")).toBe(true);
    expect(isPatternWorkspaceSettingsEditingLocked(access, "sleeveless")).toBe(false);
  });

  it("locks nosub with claimed sleeveless", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: true,
      claimedSystem: "sleeveless",
      freeClaimedPatternId: "proj-sl",
    });
    expect(isPatternWorkspaceSettingsEditingLocked(access, "sleeveless")).toBe(true);
  });

  it("allows members and beta for both systems", () => {
    const member = testAccess({ loggedIn: true, hasSystemAccess: true, freeClaimed: true });
    expect(isPatternWorkspaceSettingsEditingLocked(member, "drop-shoulder")).toBe(false);
    expect(isPatternWorkspaceSettingsEditingLocked(member, "sleeveless")).toBe(false);
  });
});

describe("resolvePatternWorkspaceSettingsEditGate", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("uses saved project construction baseline for drop-shoulder on shared workspace URL", async () => {
    writeActiveCustomPatternProjectId("proj-drop", "Drop Shoulder Vest");
    const project = {
      id: "proj-drop",
      name: "Drop Shoulder Vest",
      family: "sleeveless",
      source: "express",
      pattern: {
        style: {
          construction: DROP_SHOULDER_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        },
      },
      customOverrides: {},
    } as CustomPatternProject;
    writeHydratedConstructionBaseline(project);

    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue(
      testAccess({
        loggedIn: true,
        hasSystemAccess: false,
        freeClaimed: true,
        claimedSystem: "drop-shoulder",
        freeClaimedPatternId: "proj-drop",
      }),
    );

    vi.stubGlobal("window", { location: { pathname: "/patterns/sleeveless/pattern/" } });

    const gate = await resolvePatternWorkspaceSettingsEditGate();
    expect(gate.patternSystem).toBe("drop-shoulder");
    expect(gate.locked).toBe(true);
  });
});

describe("blockPatternWorkspaceSettingsEditOrOfferUnlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers unlock modal and returns true when locked", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    const blocked = blockPatternWorkspaceSettingsEditOrOfferUnlock(access, "drop-shoulder");
    expect(blocked).toBe(true);
    expect(offerPatternEditingUnlockModal).toHaveBeenCalledWith(access, {
      patternSystem: "drop-shoulder",
    });
  });

  it("returns false when editing is allowed", () => {
    const access = testAccess({ loggedIn: true, hasSystemAccess: true, freeClaimed: true });
    expect(blockPatternWorkspaceSettingsEditOrOfferUnlock(access, "sleeveless")).toBe(false);
    expect(offerPatternEditingUnlockModal).not.toHaveBeenCalled();
  });
});
