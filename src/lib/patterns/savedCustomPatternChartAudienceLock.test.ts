import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  loadProjectIntoWorkingDraft,
} from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { captureSavedCustomPatternDirtyBaseline } from "./customPatternSavedProjectDirtyState";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  applySavedPatternChartAudienceLockToWhoPicker,
  formatSavedPatternChartAudienceLockMessage,
  interceptBlockedExpressWhoChange,
  resolveLockedExpressWhoForSavedEdit,
  shouldBlockExpressWhoChangeForSavedEdit,
  showSavedPatternChartAudienceLockNotice,
  SAVED_PATTERN_AUDIENCE_LOCKED_WHO_CLASS,
  SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR,
} from "./savedCustomPatternChartAudienceLock";
import { detachActiveSavedProjectWhenChartAudienceDrifts } from "./savedCustomPatternSessionIdentity";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";

function childProject(): CustomPatternProject {
  return {
    id: "proj-child-8",
    name: "Child Age 8 Cardigan",
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: {},
    createdAt: "t1",
    updatedAt: "t1",
    version: 1,
    pattern: {
      id: "pat-child",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {
        patternMode: "express",
        recipientCategory: "kids",
        bodyShape: "aline",
        frontStyle: "open",
        garmentStyle: "cardigan",
        neckline: "round",
      },
      fit: {
        selectedSize: "8",
        easeChoice: "standard",
        sizingChart: "kids",
        selectedMeasurements: {
          finished_bust_chest: 26,
          back_neck_to_hem: 16,
          armhole_depth: 6,
          neck_opening: 2.5,
          shoulder_width: 3,
          front_neck_depth: 2.5,
          back_neck_depth: 0.75,
        },
      },
      yarnGauge: { stitchGauge: "6", rowGauge: "8", gaugeRawUnit: "in" },
      measurements: {},
      machine: { availableNeedles: "200" },
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Child Age 8 Cardigan",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

type WhoButton = HTMLElement & {
  lockedClass: boolean;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  getAttribute: (name: string) => string | null;
};

function createWhoPickerHostDocumentStub() {
  return {
    createElement: (tag: string) => {
      if (tag === "div") {
        return {
          className: "",
          hidden: false,
          setAttribute: vi.fn(),
          replaceChildren: vi.fn(),
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          textContent: "",
        };
      }
      if (tag === "p") {
        return { className: "", textContent: "" };
      }
      if (tag === "button") {
        return {
          type: "button",
          className: "",
          textContent: "",
          addEventListener: vi.fn(),
        };
      }
      return {};
    },
  };
}

function createWhoPickerHost(): HTMLElement {
  const whoValues = ["women", "men", "kids", "baby"] as const;
  const buttons: WhoButton[] = whoValues.map((who) => {
    const attrs = new Map<string, string>();
    const state = {
      lockedClass: false,
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
      removeAttribute: (name: string) => {
        attrs.delete(name);
      },
      classList: {
        toggle: (cls: string, on: boolean) => {
          if (cls === SAVED_PATTERN_AUDIENCE_LOCKED_WHO_CLASS) {
            state.lockedClass = on;
          }
        },
      },
      matches: () => false,
    };
    return state as unknown as WhoButton;
  });

  whoValues.forEach((who, i) => {
    buttons[i]!.setAttribute("data-choice", "");
    buttons[i]!.setAttribute("data-field", "who");
    buttons[i]!.setAttribute("data-value", who);
  });

  const whoGrid = {
    parentNode: {
      insertBefore: vi.fn(),
    },
    nextSibling: null,
  };

  const host = {
    querySelector(sel: string) {
      if (sel === ".express-options--who") return whoGrid;
      if (sel === SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR) {
        return noticeEl;
      }
      return null;
    },
    querySelectorAll(sel: string) {
      if (sel === '[data-choice][data-field="who"]') return buttons;
      return [];
    },
    appendChild: vi.fn(),
  };

  const noticeEl = {
    hidden: true,
    replaceChildren: vi.fn(),
    appendChild: vi.fn(),
    className: "",
    setAttribute: vi.fn(),
    getAttribute: () => null,
    removeAttribute: vi.fn(),
    classList: { toggle: vi.fn() },
  };

  return host as unknown as HTMLElement;
}

describe("saved pattern chart audience lock", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("formats the cross-chart guidance message", () => {
    expect(formatSavedPatternChartAudienceLockMessage("kids", "misses")).toBe(
      "This saved pattern uses the Child sizing chart. To use Women sizing, start a new pattern instead.",
    );
  });

  it("locks saved Child edit to kids express who", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    expect(resolveLockedExpressWhoForSavedEdit()).toBe("kids");
    expect(shouldBlockExpressWhoChangeForSavedEdit("women")).toBe(true);
    expect(shouldBlockExpressWhoChangeForSavedEdit("kids")).toBe(false);
  });

  it("does not detach when only size changes within the same chart", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    expect(
      detachActiveSavedProjectWhenChartAudienceDrifts({
        chartAudience: "kids",
        selectedSize: "10",
      }),
    ).toBe(false);
    expect(readActiveCustomPatternProjectId()).toBe("proj-child-8");
  });

  it("marks non-locked who cards and leaves kids selectable", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    vi.stubGlobal("document", createWhoPickerHostDocumentStub());
    const host = createWhoPickerHost();
    applySavedPatternChartAudienceLockToWhoPicker(host, "kids");

    const buttons = host.querySelectorAll('[data-choice][data-field="who"]');
    const women = buttons[0] as WhoButton;
    const kids = buttons[2] as WhoButton;

    expect(women.getAttribute("aria-disabled")).toBe("true");
    expect(women.lockedClass).toBe(true);
    expect(kids.getAttribute("aria-disabled")).toBeNull();
    expect(kids.lockedClass).toBe(false);
  });
});

describe("saved pattern chart audience lock notice", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows guidance when a blocked audience is chosen without changing the active project", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    vi.stubGlobal("document", createWhoPickerHostDocumentStub());
    const host = createWhoPickerHost();
    const blocked = interceptBlockedExpressWhoChange(host, "women");

    expect(blocked).toBe(true);
    expect(readActiveCustomPatternProjectId()).toBe("proj-child-8");

    const notice = host.querySelector(SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR) as {
      hidden?: boolean;
    };
    expect(notice?.hidden).toBe(false);
  });

  it("renders continue editing and start new pattern actions", () => {
    vi.stubGlobal("document", createWhoPickerHostDocumentStub());
    const host = createWhoPickerHost();
    const onContinue = vi.fn();
    const onStartNew = vi.fn();

    showSavedPatternChartAudienceLockNotice(
      host,
      formatSavedPatternChartAudienceLockMessage("kids", "misses"),
      { onContinueEditing: onContinue, onStartNewPattern: onStartNew },
    );

    const notice = host.querySelector(SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR);
    expect(notice).toBeTruthy();
  });
});
