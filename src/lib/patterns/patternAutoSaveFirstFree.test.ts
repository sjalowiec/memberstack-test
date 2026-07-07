import { describe, expect, it, vi, beforeEach } from "vitest";
import { maybeAutoSaveFirstFreePattern } from "./patternAutoSaveFirstFree";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

const resolveAccessMock = vi.fn<() => Promise<SleevelessUserAccess>>();
const smartSaveMock = vi.fn();
const markClaimMock = vi.fn();
const showDialogMock = vi.fn();
const readActiveIdMock = vi.fn();
const resolveNameMock = vi.fn();

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: () => resolveAccessMock(),
  markFreePatternClaimedForSystem: (...args: unknown[]) => markClaimMock(...args),
}));

vi.mock("./customPatternSavedProjectsPanel", () => ({
  smartSaveCustomPatternProject: (...args: unknown[]) => smartSaveMock(...args),
}));

vi.mock("./patternAutoSaveSuccessDialog", () => ({
  showPatternAutoSaveSuccessDialog: (...args: unknown[]) => showDialogMock(...args),
}));

vi.mock("./customPatternProjectActiveId", () => ({
  readActiveCustomPatternProjectId: () => readActiveIdMock(),
}));

vi.mock("./sleevelessPatternProjectMeta", () => ({
  resolvePatternProjectSaveName: () => resolveNameMock(),
}));

vi.mock("./patternSystemId", () => ({
  resolvePatternSystemFromPage: () => "drop-shoulder",
  patternSystemDisplayName: (id: string) => (id === "drop-shoulder" ? "Drop Shoulder" : id),
}));

const nosubUnclaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimsBySystem: {},
};

beforeEach(() => {
  resolveAccessMock.mockReset();
  smartSaveMock.mockReset();
  markClaimMock.mockReset();
  showDialogMock.mockReset();
  readActiveIdMock.mockReset();
  resolveNameMock.mockReset();
  readActiveIdMock.mockReturnValue("");
  resolveNameMock.mockReturnValue("My Drop Shoulder");
});

describe("maybeAutoSaveFirstFreePattern", () => {
  it("auto-saves and marks claim for first drop-shoulder pattern", async () => {
    resolveAccessMock.mockResolvedValue(nosubUnclaimed);
    smartSaveMock.mockResolvedValue({
      ok: true,
      created: true,
      project: { id: "proj_1", name: "My Drop Shoulder" },
    });
    markClaimMock.mockResolvedValue(true);

    const result = await maybeAutoSaveFirstFreePattern({
      patternSystem: "drop-shoulder",
      showSuccessDialog: false,
    });

    expect(result).toEqual({
      status: "saved",
      patternSystem: "drop-shoulder",
      projectId: "proj_1",
      projectName: "My Drop Shoulder",
    });
    expect(markClaimMock).toHaveBeenCalledWith("drop-shoulder", "proj_1");
  });

  it("skips when the system is already claimed", async () => {
    resolveAccessMock.mockResolvedValue({
      ...nosubUnclaimed,
      freeClaimsBySystem: { "drop-shoulder": { claimed: true, patternId: "old" } },
    });

    const result = await maybeAutoSaveFirstFreePattern({ patternSystem: "drop-shoulder" });
    expect(result).toEqual({ status: "skipped", reason: "already-claimed" });
    expect(smartSaveMock).not.toHaveBeenCalled();
  });

  it("skips for members", async () => {
    resolveAccessMock.mockResolvedValue({
      ...nosubUnclaimed,
      hasSystemAccess: true,
    });

    const result = await maybeAutoSaveFirstFreePattern({ patternSystem: "sleeveless" });
    expect(result).toEqual({ status: "skipped", reason: "has-system-access" });
  });
});
