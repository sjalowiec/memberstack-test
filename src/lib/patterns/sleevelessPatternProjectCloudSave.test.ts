import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindSleevelessPatternProjectCloudSave,
  runSleevelessPatternProjectCloudSave,
  setSleevelessPatternProjectCloudSaveStatus,
} from "./sleevelessPatternProjectCloudSave";

vi.mock("./customPatternSavedProjectsPanel", () => ({
  smartSaveCustomPatternProject: vi.fn(),
}));

import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";

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
    await handler();
    expect(smartSaveCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(root._status.textContent).toBe('Updated “Updated”.');
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
