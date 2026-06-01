import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  bindSleevelessPatternProjectCloudSave,
  runSleevelessPatternProjectCloudSave,
  setSleevelessPatternProjectCloudSaveStatus,
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";

vi.mock("./customPatternSavedProjectsPanel", () => ({
  smartSaveCustomPatternProject: vi.fn(),
  resolveDefaultCustomPatternSaveMode: vi.fn(() => "create"),
}));

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: vi
    .fn()
    .mockResolvedValue({ loggedIn: true, hasSystemAccess: true, freeClaimed: false }),
  markFreeSleevelessPatternClaimed: vi.fn().mockResolvedValue(true),
}));

import {
  resolveDefaultCustomPatternSaveMode,
  smartSaveCustomPatternProject,
} from "./customPatternSavedProjectsPanel";
import {
  markFreeSleevelessPatternClaimed,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

function makeStatusEl() {
  const el = {
    textContent: "",
    classList: {
      contains: (c: string) => el._error && c === "cb-project-status--error",
      toggle: (c: string, on: boolean) => {
        if (c === "cb-project-status--error") el._error = on;
      },
    },
    _error: false,
  };
  return el;
}

function makeSaveRoot(options?: { withButton?: boolean }) {
  const status = makeStatusEl();
  const button = {
    disabled: false,
    dataset: {} as DOMStringMap,
    addEventListener: vi.fn(),
  };
  const root = {
    querySelector: (sel: string) => {
      if (sel === "[data-cb-project-status]") return status;
      if (sel === "[data-sleeveless-pattern-project-cloud-save]") {
        return options?.withButton === false ? null : button;
      }
      return null;
    },
    _status: status,
    _button: button,
  };
  return root as unknown as HTMLElement & { _status: ReturnType<typeof makeStatusEl>; _button: typeof button };
}

describe("sleevelessPatternProjectCloudSave", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sets error status when name is empty", async () => {
    const root = makeSaveRoot();
    const onMissingName = vi.fn();

    await runSleevelessPatternProjectCloudSave(root, {
      resolveName: () => "  ",
      onMissingName,
    });

    expect(root._status.textContent).toBe("Enter a pattern name before saving.");
    expect(root._status._error).toBe(true);
    expect(onMissingName).toHaveBeenCalled();
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });

  it("shows saved message after create", async () => {
    const root = makeSaveRoot();
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: true,
      project: {
        id: "p1",
        name: "Mom's vest",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    await runSleevelessPatternProjectCloudSave(root, {
      resolveName: () => "Mom's vest",
    });

    expect(root._status.textContent).toBe('Saved “Mom\'s vest”.');
    expect(root._button.disabled).toBe(false);
    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.not.objectContaining({ mode: "create" }),
    );
  });

  it("updates the linked project instead of passing explicit create mode", async () => {
    const root = makeSaveRoot();
    writeActiveCustomPatternProjectId("p1", "Mom's vest");
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: false,
      project: {
        id: "p1",
        name: "Mom's vest",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    await runSleevelessPatternProjectCloudSave(root, {
      resolveName: () => "Mom's vest",
    });

    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({
        resolveName: expect.any(Function),
      }),
    );
    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.not.objectContaining({ mode: "create" }),
    );
    expect(root._status.textContent).toBe('Updated “Mom\'s vest”.');
  });

  it("bindSleevelessPatternProjectCloudSave wires click once", async () => {
    const root = makeSaveRoot();
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: false,
      project: {
        id: "p1",
        name: "Updated",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    bindSleevelessPatternProjectCloudSave(root, { resolveName: () => "Updated" });
    bindSleevelessPatternProjectCloudSave(root, { resolveName: () => "Updated" });

    expect(root._button.addEventListener).toHaveBeenCalledTimes(1);
    const handler = root._button.addEventListener.mock.calls[0]?.[1] as () => void;
    handler();
    await vi.waitFor(() => expect(root._status.textContent).toBe('Updated “Updated”.'));
    expect(smartSaveCustomPatternProject).toHaveBeenCalledTimes(1);
  });

  it("blocks a logged-out visitor from creating a pattern", async () => {
    const root = makeSaveRoot();
    vi.mocked(resolveDefaultCustomPatternSaveMode).mockReturnValue("create");
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: false,
      hasSystemAccess: false,
      freeClaimed: false,
    });

    await runSleevelessPatternProjectCloudSave(root, { resolveName: () => "Anon vest" });

    expect(root._status.textContent).toBe(SLEEVELESS_SAVE_LOGGED_OUT_COPY);
    expect(root._status._error).toBe(true);
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });

  it("blocks a free user who already claimed from creating another pattern", async () => {
    const root = makeSaveRoot();
    vi.mocked(resolveDefaultCustomPatternSaveMode).mockReturnValue("create");
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: true,
      freeClaimedPatternId: "p1",
    });

    await runSleevelessPatternProjectCloudSave(root, { resolveName: () => "Second vest" });

    expect(root._status.textContent).toBe(SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY);
    expect(root._status._error).toBe(true);
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });

  it("marks the free pattern claimed after the first create", async () => {
    const root = makeSaveRoot();
    vi.mocked(resolveDefaultCustomPatternSaveMode).mockReturnValue("create");
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: false,
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: true,
      project: {
        id: "free-1",
        name: "My first vest",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    await runSleevelessPatternProjectCloudSave(root, { resolveName: () => "My first vest" });

    expect(smartSaveCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(markFreeSleevelessPatternClaimed).toHaveBeenCalledWith("free-1");
    expect(root._status.textContent).toBe('Saved “My first vest”.');
  });

  it("records the one-time allowance on a member's first create too", async () => {
    const root = makeSaveRoot();
    vi.mocked(resolveDefaultCustomPatternSaveMode).mockReturnValue("create");
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: true,
      freeClaimed: false,
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: true,
      project: {
        id: "m1",
        name: "Member vest",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    await runSleevelessPatternProjectCloudSave(root, { resolveName: () => "Member vest" });

    // Marking has no effect while they have access, but ensures creation/regeneration lock
    // correctly if their entitlement later ends.
    expect(markFreeSleevelessPatternClaimed).toHaveBeenCalledWith("m1");
  });

  it("does not re-mark the allowance on a subsequent create once already used", async () => {
    const root = makeSaveRoot();
    vi.mocked(resolveDefaultCustomPatternSaveMode).mockReturnValue("create");
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: true,
      freeClaimed: true,
      freeClaimedPatternId: "m1",
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: true,
      project: {
        id: "m2",
        name: "Member vest 2",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    await runSleevelessPatternProjectCloudSave(root, { resolveName: () => "Member vest 2" });

    expect(markFreeSleevelessPatternClaimed).not.toHaveBeenCalled();
  });

  it("setSleevelessPatternProjectCloudSaveStatus toggles error class", () => {
    const root = makeSaveRoot();
    setSleevelessPatternProjectCloudSaveStatus(root, "Saving…");
    expect(root._status.textContent).toBe("Saving…");
    expect(root._status._error).toBe(false);

    setSleevelessPatternProjectCloudSaveStatus(root, "Failed", true);
    expect(root._status._error).toBe(true);
  });
});
